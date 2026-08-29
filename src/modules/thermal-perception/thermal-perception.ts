/**
 * Purpose: Turn surface color into the Level 05 heat response inside a viewer radius.
 * Context: Thermal Perception must decorate Terrain, Vegetation, Rocks, Grass, and Animals in their passes.
 * Responsibility: Configure shared ramp uniforms, per-consumer warmth, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; colors outside the radius stay theirs.
 */

import { Color, type Material, Vector2, Vector4 } from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import type {
  ActorMaterialEffect,
  UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import {
  applyShaderPatch,
  type MaterialShaderPatch,
} from "../../utils/asset-loader/material-shader-patch";
import { getElevationRange } from "../../world-surface/height-field";
import type { WorldSurfaceSettings } from "../../world-surface/surface-settings";
import { isWater, type ZoneConditions } from "../../world-surface/zone-field";
import actorVertexShader from "./thermal-actor.vert.glsl?raw";
import detailFieldShader from "./thermal-detail-field.glsl?raw";
import grassVertexShader from "./thermal-grass.vert.glsl?raw";
import groundHeatShader from "./thermal-ground-heat.glsl?raw";
import instancedVertexShader from "./thermal-instanced.vert.glsl?raw";
import fragmentShader from "./thermal-perception.frag.glsl?raw";
import {
  THERMAL_GROUND_HEAT_SOURCE_COUNT,
  THERMAL_PERCEPTION_SETTINGS,
  type ThermalDetailSettings,
  type ThermalPerceptionParameters,
} from "./thermal-perception-settings";
import surfaceStructureShader from "./thermal-surface-structure.glsl?raw";
import terrainVertexShader from "./thermal-terrain.vert.glsl?raw";

export type { ThermalPerceptionParameters } from "./thermal-perception-settings";

const THERMAL_TERRAIN_CACHE_KEY = "thermal-terrain-v2";
const THERMAL_INSTANCED_CACHE_KEY = "thermal-instanced-v2";
const THERMAL_ACTOR_CACHE_KEY = "thermal-actor-v2";
const THERMAL_GRASS_CACHE_KEY = "thermal-grass-v2";

const THERMAL_VERTEX_CALL = "passThermalPerception(mvPosition);";
/** Grass publishes its world position, blade progress, and sway at the anchor. */
const THERMAL_GRASS_VERTEX_CALL =
  "passThermalPerception(mvPosition, transformed, grassBladeProgress, grassSway);";

/**
 * Only Terrain receives external heat sources, and only its program defines
 * this, so every other consumer compiles the shared fragment body without the
 * heat-source loop in it at all.
 */
const THERMAL_GROUND_HEAT_DEFINE = "#define THERMAL_GROUND_HEAT";

/**
 * The detail field is the one genuinely expensive thing this sense does per
 * fragment. A consumer whose detail amplitudes are all zero compiles none of
 * it, so this is a real per-surface-kind performance lever rather than a
 * multiply by zero.
 */
const THERMAL_DETAIL_DEFINE = "#define THERMAL_DETAIL";

/** Warmth mottling stays deterministic: one lattice for the whole world. */
const mottleNoise = new ImprovedNoise();

type UniformSet = Record<string, { value: unknown }>;

/** Terrain variant; the sampler fills the per-vertex warmth attribute. */
export interface ThermalTerrainEffect {
  readonly applyTo: (material: Material) => void;
  readonly warmthAt: (
    worldX: number,
    worldZ: number,
    groundYMeters: number,
  ) => number;

  /**
   * Warm bodies leave heat on the ground under them. The composition root
   * republishes the current sources every frame between `clearHeatSources`
   * and the next frame's clear; sources beyond the fixed uniform capacity are
   * ignored. This module never learns where the positions come from.
   */
  readonly clearHeatSources: () => void;
  readonly addHeatSource: (
    worldX: number,
    worldY: number,
    worldZ: number,
  ) => void;
}

/** One effect per consumer module, sharing radius and palette uniforms. */
export interface ThermalPerceptionEffects {
  readonly terrain: ThermalTerrainEffect;
  readonly vegetation: UnlitMaterialEffect;
  readonly rocks: UnlitMaterialEffect;
  readonly animals: ActorMaterialEffect;
  readonly grass: UnlitMaterialEffect;
}

export interface ThermalPerceptionOptions {
  readonly surfaceSettings: WorldSurfaceSettings;
  readonly conditionsAt: (worldX: number, worldZ: number) => ZoneConditions;
}

/** Create one shared heat view; apply its variants to every sensed material. */
export function createThermalPerception(
  parameters: ThermalPerceptionParameters,
  options: ThermalPerceptionOptions,
): ThermalPerceptionEffects {
  validateThermalPerceptionParameters(parameters);
  // One uniform object each, shared by every patched program, so a future
  // runtime intensity driver reaches all consumers through a single value.
  const sharedUniforms = {
    thermalIntensity: { value: parameters.intensity },
    thermalRadiusMeters: { value: parameters.radiusMeters },
    thermalEdgeFeatherMeters: { value: parameters.edgeFeatherMeters },
    thermalEdgeBreakupMeters: {
      value: THERMAL_PERCEPTION_SETTINGS.ramp.edgeBreakupMeters,
    },
    thermalRampStops: {
      value: new Vector4(
        THERMAL_PERCEPTION_SETTINGS.ramp.coldStopFraction,
        THERMAL_PERCEPTION_SETTINGS.ramp.coolStopFraction,
        THERMAL_PERCEPTION_SETTINGS.ramp.warmStopFraction,
        THERMAL_PERCEPTION_SETTINGS.ramp.hotStopFraction,
      ),
    },
    thermalSegmentEase: {
      value: THERMAL_PERCEPTION_SETTINGS.ramp.segmentEase,
    },
    thermalHeatVisibility: {
      value: new Vector2(
        THERMAL_PERCEPTION_SETTINGS.ramp.transparentBelowWarmth,
        THERMAL_PERCEPTION_SETTINGS.ramp.opaqueAboveWarmth,
      ),
    },
    thermalColdestColor: {
      value: createRampColor(parameters.colors.coldestColor),
    },
    thermalColdColor: { value: createRampColor(parameters.colors.coldColor) },
    thermalCoolColor: { value: createRampColor(parameters.colors.coolColor) },
    thermalWarmColor: { value: createRampColor(parameters.colors.warmColor) },
    thermalHotColor: { value: createRampColor(parameters.colors.hotColor) },
    thermalHottestColor: {
      value: createRampColor(parameters.colors.hottestColor),
    },
    ...createSurfaceLuminanceUniforms(),
  };
  const groundHeat = createGroundHeatSources();
  const propStructure = THERMAL_PERCEPTION_SETTINGS.propStructure;

  return {
    terrain: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_TERRAIN_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createEnvironmentCeilingUniform(),
          ...createDetailUniforms(
            THERMAL_PERCEPTION_SETTINGS.terrainWarmth.detail,
          ),
          ...groundHeat.uniforms,
        },
        vertexHeader: terrainVertexShader,
        fragmentHeader: createFragmentHeader(
          THERMAL_PERCEPTION_SETTINGS.terrainWarmth.detail,
          true,
        ),
      }),
      warmthAt: createTerrainWarmthSampler(options),
      clearHeatSources: groundHeat.clear,
      addHeatSource: groundHeat.add,
    },
    vegetation: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_INSTANCED_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createEnvironmentCeilingUniform(),
          ...createDetailUniforms(propStructure.detail),
          ...createInstancedWarmthUniforms(
            parameters.surfaces.vegetationWarmth,
            parameters.surfaces.vegetationWarmthSpread,
          ),
        },
        vertexHeader: `${surfaceStructureShader}\n${instancedVertexShader}`,
        fragmentHeader: createFragmentHeader(propStructure.detail),
      }),
    },
    rocks: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_INSTANCED_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createEnvironmentCeilingUniform(),
          ...createDetailUniforms(propStructure.detail),
          ...createInstancedWarmthUniforms(
            parameters.surfaces.rockWarmth,
            parameters.surfaces.rockWarmthSpread,
          ),
        },
        vertexHeader: `${surfaceStructureShader}\n${instancedVertexShader}`,
        fragmentHeader: createFragmentHeader(propStructure.detail),
      }),
    },
    animals: {
      // Body height arrives per actor, so every animal material carries its
      // own copy of that one value while sharing the program and every other
      // uniform object.
      applyTo: (material, bodyHeightMeters) =>
        createPatchApplier({
          cacheKey: THERMAL_ACTOR_CACHE_KEY,
          uniforms: {
            ...sharedUniforms,
            ...createLivingCeilingUniform(),
            ...createDetailUniforms(
              THERMAL_PERCEPTION_SETTINGS.actorStructure.detail,
            ),
            ...createActorWarmthUniforms(
              parameters.actorWarmth,
              bodyHeightMeters,
            ),
          },
          vertexHeader: `${surfaceStructureShader}\n${actorVertexShader}`,
          fragmentHeader: createFragmentHeader(
            THERMAL_PERCEPTION_SETTINGS.actorStructure.detail,
          ),
        })(material),
    },
    grass: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_GRASS_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createEnvironmentCeilingUniform(),
          ...createDetailUniforms(
            THERMAL_PERCEPTION_SETTINGS.grassStructure.detail,
          ),
          ...createGrassWarmthUniforms(parameters.surfaces.vegetationWarmth),
        },
        vertexHeader: grassVertexShader,
        fragmentHeader: createFragmentHeader(
          THERMAL_PERCEPTION_SETTINGS.grassStructure.detail,
        ),
        vertexCall: THERMAL_GRASS_VERTEX_CALL,
      }),
    },
  };
}

/**
 * Pre-encode a palette anchor into gamma space, where the fragment ramp
 * interpolates it before squaring the result back. The anchors themselves come
 * out unchanged; only the path between two of them does, and that path is
 * where every intermediate temperature lives.
 */
function createRampColor(hex: number): Color {
  const color = new Color(hex);
  return color.setRGB(
    Math.sqrt(color.r),
    Math.sqrt(color.g),
    Math.sqrt(color.b),
  );
}

/** Grass is vegetation, so it starts from the authored vegetation warmth. */
function createGrassWarmthUniforms(baseWarmth: number): UniformSet {
  const structure = THERMAL_PERCEPTION_SETTINGS.grassStructure;

  return {
    thermalBaseWarmth: { value: baseWarmth },
    thermalRootWarmthBoost: { value: structure.rootWarmthBoost },
    thermalShimmerWarmth: { value: structure.shimmerWarmth },
    thermalGrassRootShade: { value: structure.rootShade },
  };
}

/**
 * Compose one consumer's fragment stage. Both defines gate real work out of the
 * program rather than multiplying it by zero: only Terrain compiles the
 * heat-source loop, and only a consumer that actually asks for spatial detail
 * compiles the octaves, the hotspot tail, and the edge breakup.
 */
function createFragmentHeader(
  detail: ThermalDetailSettings,
  receivesGroundHeat = false,
): string {
  const body = [detailFieldShader];
  if (hasSpatialDetail(detail)) body.unshift(THERMAL_DETAIL_DEFINE);
  if (receivesGroundHeat) {
    body.unshift(THERMAL_GROUND_HEAT_DEFINE);
    body.push(groundHeatShader);
  }
  body.push(fragmentShader);
  return body.join("\n");
}

function hasSpatialDetail(detail: ThermalDetailSettings): boolean {
  return (
    detail.coarseWarmth > 0 || detail.fineWarmth > 0 || detail.hotspotWarmth > 0
  );
}

function createPatchApplier(
  variant: Pick<
    MaterialShaderPatch,
    "cacheKey" | "uniforms" | "vertexHeader" | "fragmentHeader"
  > &
    Partial<Pick<MaterialShaderPatch, "vertexCall">>,
): (material: Material) => void {
  return (material) => {
    applyShaderPatch(material, {
      vertexCall: THERMAL_VERTEX_CALL,
      ...variant,
      vertexAnchor: "#include <project_vertex>",
      colorFragmentCall:
        "diffuseColor.rgb = applyThermalPerception(diffuseColor.rgb);",
    });
  };
}

interface GroundHeatSources {
  readonly uniforms: UniformSet;
  readonly clear: () => void;
  readonly add: (worldX: number, worldY: number, worldZ: number) => void;
}

/**
 * Hold the fixed pool of ground heat sources. The vectors are allocated once
 * and rewritten in place, so republishing them every frame allocates nothing.
 */
function createGroundHeatSources(): GroundHeatSources {
  const { radiusMeters, warmth, edgeBreakup } =
    THERMAL_PERCEPTION_SETTINGS.groundHeat;
  const sources = Array.from(
    { length: THERMAL_GROUND_HEAT_SOURCE_COUNT },
    () => new Vector4(0, 0, 0, 0),
  );
  let usedCount = 0;

  return {
    uniforms: {
      thermalHeatSources: { value: sources },
      thermalGroundHeatRadiusMeters: { value: radiusMeters },
      thermalGroundHeatEdgeBreakup: { value: edgeBreakup },
    },
    clear: () => {
      for (const source of sources) source.w = 0;
      usedCount = 0;
    },
    add: (worldX, worldY, worldZ) => {
      const source = sources[usedCount];
      if (!source) return;

      source.set(worldX, worldY, worldZ, warmth);
      usedCount += 1;
    },
  };
}

/**
 * The soft ceiling every surface that is not alive passes through, so no
 * accumulation of environmental boosts can carry the ground past a body
 * standing on it.
 */
function createEnvironmentCeilingUniform(): UniformSet {
  const ceiling = THERMAL_PERCEPTION_SETTINGS.environmentCeiling;

  return {
    thermalWarmthCeiling: {
      value: new Vector2(ceiling.kneeWarmth, ceiling.ceilingWarmth),
    },
  };
}

/**
 * Living bodies get a knee at the top of the range, where warmth is already
 * clamped: the same expression then leaves them untouched, so the ceiling
 * needs no second program and no branch.
 */
function createLivingCeilingUniform(): UniformSet {
  return { thermalWarmthCeiling: { value: new Vector2(1, 2) } };
}

/** Per-consumer fragment detail: two octaves, the hotspot tail, and the tone. */
function createDetailUniforms(detail: ThermalDetailSettings): UniformSet {
  const shared = THERMAL_PERCEPTION_SETTINGS.detail;

  return {
    thermalDetailWavelengthMeters: {
      value: new Vector2(
        detail.coarseWavelengthMeters,
        detail.fineWavelengthMeters,
      ),
    },
    thermalDetailWarmth: {
      value: new Vector2(detail.coarseWarmth, detail.fineWarmth),
    },
    thermalDetailFadeMeters: {
      value: new Vector2(shared.fadeStartMeters, shared.fadeEndMeters),
    },
    thermalHotspotWarmth: { value: detail.hotspotWarmth },
    thermalHotspotThreshold: { value: shared.hotspotThreshold },
    thermalToneWarmth: { value: detail.toneWarmth },
  };
}

/** Shared by every variant: the surface tone that shows through the ramp. */
function createSurfaceLuminanceUniforms(): UniformSet {
  const luminance = THERMAL_PERCEPTION_SETTINGS.surfaceLuminance;

  return {
    thermalLuminanceReference: { value: luminance.referenceLuminance },
    thermalLuminanceAmount: { value: luminance.structureAmount },
    thermalMinimumShade: { value: luminance.minimumShade },
    thermalMaximumShade: { value: luminance.maximumShade },
  };
}

/** Only the variants that have a normal to shade with; Terrain has none. */
function createSurfaceShadeUniforms(): UniformSet {
  const shade = THERMAL_PERCEPTION_SETTINGS.surfaceShade;

  return {
    thermalGroundShade: { value: shade.groundShade },
    thermalSkyShade: { value: shade.skyShade },
  };
}

function createInstancedWarmthUniforms(
  baseWarmth: number,
  warmthSpread: number,
): UniformSet {
  const structure = THERMAL_PERCEPTION_SETTINGS.propStructure;

  return {
    thermalBaseWarmth: { value: baseWarmth },
    thermalWarmthSpread: { value: warmthSpread },
    thermalHashCellMeters: {
      value: THERMAL_PERCEPTION_SETTINGS.instanceHashCellMeters,
    },
    thermalHeightReferenceMeters: { value: structure.heightReferenceMeters },
    thermalHeightWarmthHalfDrop: { value: structure.heightWarmthHalfDrop },
    thermalAxisReferenceMeters: { value: structure.axisReferenceMeters },
    thermalAxisWarmthHalfDrop: { value: structure.axisWarmthHalfDrop },
    thermalGrainWavelengthMeters: { value: structure.grainWavelengthMeters },
    thermalGrainWarmth: { value: structure.grainWarmth },
    thermalGrazingCoolness: { value: structure.grazingCoolness },
    thermalDetailPhaseMeters: { value: structure.detailPhaseMeters },
    ...createSurfaceShadeUniforms(),
  };
}

function createActorWarmthUniforms(
  actorWarmth: number,
  bodyHeightMeters: number,
): UniformSet {
  const structure = THERMAL_PERCEPTION_SETTINGS.actorStructure;

  return {
    thermalActorWarmth: { value: actorWarmth },
    thermalActorWarmthRange: { value: structure.warmthRange },
    thermalBodyHeightMeters: { value: bodyHeightMeters },
    thermalCoreHeightFraction: { value: structure.coreHeightFraction },
    thermalCoreSpread: {
      value: new Vector2(
        structure.coreInnerFraction,
        structure.coreOuterFraction,
      ),
    },
    thermalCoreRadiusSpread: {
      value: new Vector2(
        structure.coreRadiusInnerFraction,
        structure.coreRadiusOuterFraction,
      ),
    },
    thermalHeadHeightFraction: { value: structure.headHeightFraction },
    thermalHeadSpread: {
      value: new Vector2(
        structure.headInnerFraction,
        structure.headOuterFraction,
      ),
    },
    thermalHeadWarmthShare: { value: structure.headWarmthShare },
    thermalTipStartFraction: { value: structure.tipStartFraction },
    thermalTipCoolShare: { value: structure.tipCoolShare },
    thermalGrainWavelengthMeters: { value: structure.grainWavelengthMeters },
    thermalGrainWarmth: { value: structure.grainWarmth },
    thermalGrazingCoolness: { value: structure.grazingCoolness },
    ...createSurfaceShadeUniforms(),
  };
}

/**
 * Map water depth, elevation, solar exposure, canopy shade, and mottling onto
 * one 0..1 warmth.
 *
 * The budget is the point of this function: floor, exposure, and mottling
 * together reach 0.48, far under the environment ceiling, so the warmest ground
 * in the world still lands in the cool half of the ramp. Ground that saturated
 * the top of the ramp is what let a sunlit forest slope read hotter than a
 * deer, and it left the heat pools warm bodies leave behind nowhere to go but a
 * flat clipped disc.
 */
function createTerrainWarmthSampler({
  surfaceSettings,
  conditionsAt,
}: ThermalPerceptionOptions): ThermalTerrainEffect["warmthAt"] {
  const { minimumElevation, maximumElevation } =
    getElevationRange(surfaceSettings);
  const elevationSpan = maximumElevation - minimumElevation;
  const warmth = THERMAL_PERCEPTION_SETTINGS.terrainWarmth;

  return (worldX, worldZ, groundYMeters) => {
    const mottle = sampleWarmthMottle(worldX, worldZ);
    const conditions = conditionsAt(worldX, worldZ);
    if (isWater(conditions)) {
      return (
        Math.max(
          0,
          warmth.shorelineWarmth -
            conditions.waterDepthMeters * warmth.waterColdPerDepthMeter,
        ) +
        mottle * warmth.waterMottleWarmth
      );
    }

    const elevationProgress = Math.min(
      Math.max((groundYMeters - minimumElevation) / elevationSpan, 0),
      1,
    );
    // Everything a surface gains from the sky, before the canopy takes its
    // share back: open high ground bakes, steep faces catch more of it.
    const solarGain =
      elevationProgress * warmth.landElevationWarmthSpan +
      Math.min(conditions.groundSlope, 1) * warmth.slopeWarmthBoost;
    // Shade scales that gain instead of subtracting from the floor, so shaded
    // forest ground reads cooler than open ground at the same elevation while
    // dry land still never drops into the water band.
    const exposure =
      1 -
      Math.min(Math.abs(conditions.forestRegionValue), 1) *
        warmth.canopyShadeFraction;

    return Math.min(
      1,
      warmth.landWarmthFloor +
        exposure * solarGain +
        mottle * warmth.landMottleWarmth,
    );
  };
}

/**
 * Two octaves of continuous noise in 0..1, breaking the large flat regions
 * elevation and zone facts produce. Both stay well above the two-metre terrain
 * vertex spacing: anything finer aliases against the grid rather than reading
 * as mottling, which is why the fine detail is measured per fragment instead.
 * Adding only warmth keeps water below the dry-ground floor, so the mottling
 * never reorders the semantic bands.
 */
function sampleWarmthMottle(worldX: number, worldZ: number): number {
  const warmth = THERMAL_PERCEPTION_SETTINGS.terrainWarmth;
  const base = mottleNoise.noise(
    worldX / warmth.mottleWavelengthMeters,
    0.37,
    worldZ / warmth.mottleWavelengthMeters,
  );
  const detail = mottleNoise.noise(
    worldX / warmth.mottleDetailWavelengthMeters,
    11.7,
    worldZ / warmth.mottleDetailWavelengthMeters,
  );
  const combined =
    base * (1 - warmth.mottleDetailShare) + detail * warmth.mottleDetailShare;

  return Math.min(Math.max(combined * 0.5 + 0.5, 0), 1);
}

function validateThermalPerceptionParameters(
  parameters: ThermalPerceptionParameters,
): void {
  const normalizedValues = [
    parameters.intensity,
    parameters.surfaces.vegetationWarmth,
    parameters.surfaces.vegetationWarmthSpread,
    parameters.surfaces.rockWarmth,
    parameters.surfaces.rockWarmthSpread,
    parameters.actorWarmth,
  ];
  if (!normalizedValues.every(isNormalized)) {
    throw new RangeError(
      "Thermal intensity and warmth values must be between zero and one",
    );
  }
  if (!isPositiveFinite(parameters.radiusMeters)) {
    throw new RangeError("Thermal radius must be positive and finite");
  }
  if (
    !isPositiveFinite(parameters.edgeFeatherMeters) ||
    parameters.edgeFeatherMeters >= parameters.radiusMeters
  ) {
    throw new RangeError(
      "Thermal edge feather must be positive and fit inside the radius",
    );
  }
  // The two warmth bands must not meet. Everything that is not alive is held
  // under the ceiling; if a body's core sits under it too, the sense stops
  // being able to say which things in the world are warm.
  if (
    parameters.actorWarmth <=
    THERMAL_PERCEPTION_SETTINGS.environmentCeiling.ceilingWarmth
  ) {
    throw new RangeError(
      "Thermal actor warmth must stay above the environment ceiling",
    );
  }
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNormalized(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
