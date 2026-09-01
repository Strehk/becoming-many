/**
 * Purpose: Turn surface color into the Level 05 heat response inside a viewer radius.
 * Context: Thermal Perception must decorate Terrain, Vegetation, Rocks, and Animals in their passes.
 * Responsibility: Configure shared ramp uniforms, per-consumer warmth, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; colors outside the radius stay theirs.
 */

import {
  Color,
  type Matrix4,
  type MeshBasicMaterial,
  Vector2,
  Vector4,
} from "three";
import type {
  SensedMaterial,
  UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import {
  applyShaderPatch,
  type MaterialShaderPatch,
} from "../../utils/asset-loader/material-shader-patch";
import { isNormalized, isPositiveFinite } from "../../utils/number-ranges";
import { getElevationRange } from "../../world-surface/height-field";
import type { WorldSurfaceSettings } from "../../world-surface/surface-settings";
import { isWater, type ZoneConditions } from "../../world-surface/zone-field";
import actorVertexShader from "./thermal-actor.vert.glsl?raw";
import instancedVertexShader from "./thermal-instanced.vert.glsl?raw";
import fragmentShader from "./thermal-perception.frag.glsl?raw";
import {
  THERMAL_PERCEPTION_SETTINGS,
  type ThermalHeatSource,
  type ThermalPerceptionParameters,
  type ThermalWarmthBand,
} from "./thermal-perception-settings";
import terrainVertexShader from "./thermal-terrain.vert.glsl?raw";

export type {
  ThermalHeatSource,
  ThermalPerceptionParameters,
} from "./thermal-perception-settings";

/*
 * The bounded source count is a compile-time array size in the shared
 * fragment stage, so it is injected rather than written twice.
 */
const SHADER_DEFINES = [
  `#define THERMAL_HEAT_SOURCES ${THERMAL_PERCEPTION_SETTINGS.heat.maxSources}`,
  `#define THERMAL_TEXTURE_OCTAVES ${THERMAL_PERCEPTION_SETTINGS.texture.octaves}`,
].join("\n");

const THERMAL_TERRAIN_CACHE_KEY = "thermal-terrain-v8";
const THERMAL_INSTANCED_CACHE_KEY = "thermal-instanced-v8";
const THERMAL_ACTOR_CACHE_KEY = "thermal-actor-v8";

/** Terrain variant; the sampler fills the per-vertex warmth attribute. */
export interface ThermalTerrainEffect {
  readonly applyTo: (material: MeshBasicMaterial) => void;
  readonly warmthAt: (
    worldX: number,
    worldZ: number,
    groundYMeters: number,
  ) => number;
}

/** One effect per consumer module, sharing radius and palette uniforms. */
export interface ThermalPerceptionEffects {
  readonly terrain: ThermalTerrainEffect;
  readonly vegetation: UnlitMaterialEffect;
  readonly rocks: UnlitMaterialEffect;
  /**
   * Report the warm bodies now standing in the world. Every sensed surface
   * shares one source set, so a single call reaches all of them; passing no
   * sources leaves the world unwarmed.
   */
  readonly setHeatSources: (sources: readonly ThermalHeatSource[]) => void;

  /** Drive the sense strength at runtime; every sensed surface shares it. */
  readonly setIntensity: (intensity: number) => void;

  /**
   * Actor variant; the caller supplies the matrix mapping one animated mesh's
   * local space onto its actor's normalized body space, so the core-to-limb
   * falloff measures against the body it belongs to instead of world metres.
   */
  readonly animals: (bodyMatrix: Matrix4) => UnlitMaterialEffect;
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
  const heat = createHeatSourceField(parameters.heatEmission);
  // One uniform object each, shared by every patched program, so a future
  // runtime intensity driver reaches all consumers through a single value.
  const sharedUniforms = {
    thermalIntensity: { value: parameters.intensity },
    thermalRadiusMeters: { value: parameters.radiusMeters },
    thermalEdgeFeatherMeters: { value: parameters.edgeFeatherMeters },
    thermalCarriedColorBlend: { value: parameters.carriedColorBlend },
    thermalRampStops: {
      value: new Vector4(
        THERMAL_PERCEPTION_SETTINGS.coldStopFraction,
        THERMAL_PERCEPTION_SETTINGS.coolStopFraction,
        THERMAL_PERCEPTION_SETTINGS.warmStopFraction,
        THERMAL_PERCEPTION_SETTINGS.hotStopFraction,
      ),
    },
    thermalColdestColor: { value: new Color(parameters.colors.coldestColor) },
    thermalColdColor: { value: new Color(parameters.colors.coldColor) },
    thermalCoolColor: { value: new Color(parameters.colors.coolColor) },
    thermalWarmColor: { value: new Color(parameters.colors.warmColor) },
    thermalHotColor: { value: new Color(parameters.colors.hotColor) },
    thermalHottestColor: { value: new Color(parameters.colors.hottestColor) },
    thermalTextureShape: {
      value: new Vector4(
        THERMAL_PERCEPTION_SETTINGS.texture.lacunarity,
        THERMAL_PERCEPTION_SETTINGS.texture.gain,
        THERMAL_PERCEPTION_SETTINGS.texture.quietWarmth,
        THERMAL_PERCEPTION_SETTINGS.texture.quietAmount,
      ),
    },
    thermalHeatShapeMeters: {
      value: THERMAL_PERCEPTION_SETTINGS.heat.shapeIrregularityMeters,
    },
    ...heat.uniforms,
  };
  const worldFeatureSize =
    THERMAL_PERCEPTION_SETTINGS.texture.featureSizeMeters;
  const actorBody = THERMAL_PERCEPTION_SETTINGS.actorBody;
  const actorUniforms = {
    thermalActorWarmth: { value: parameters.actorWarmth },
    thermalActorExtremityFalloff: { value: parameters.actorExtremityFalloff },
    ...createTextureUniforms(
      parameters.actorTextureWarmth,
      THERMAL_PERCEPTION_SETTINGS.texture.bodyFeatureFraction,
    ),
    ...createContrastUniform(
      parameters.actorContrast,
      THERMAL_PERCEPTION_SETTINGS.definition.actorPivot,
    ),
    ...createBandUniforms(parameters.bands.animals),
    thermalActorBodyShape: {
      value: new Vector4(
        actorBody.coreHeightFraction,
        actorBody.coreRadiusFraction,
        actorBody.extremityReachFraction,
        actorBody.horizontalWeight,
      ),
    },
  };

  return {
    setHeatSources: heat.setSources,
    setIntensity: (intensity) => {
      sharedUniforms.thermalIntensity.value = intensity;
    },
    terrain: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_TERRAIN_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createTextureUniforms(
            parameters.terrainTextureWarmth,
            worldFeatureSize,
          ),
          ...createContrastUniform(
            parameters.terrainContrast,
            THERMAL_PERCEPTION_SETTINGS.definition.terrainPivot,
          ),
          ...createBandUniforms(parameters.bands.terrain),
          ...HEAT_SENSED,
        },
        vertexHeader: terrainVertexShader,
      }),
      warmthAt: createTerrainWarmthSampler(options),
    },
    vegetation: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_INSTANCED_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createInstancedWarmthUniforms(
            parameters.surfaces.vegetationWarmth,
            parameters.surfaces.vegetationWarmthSpread,
            parameters.surfaces.vegetationHeightWarmthPerMeter,
            parameters.surfaces.vegetationAxisWarmthPerMeter,
          ),
          ...createTextureUniforms(
            parameters.surfaces.vegetationTextureWarmth,
            worldFeatureSize,
          ),
          ...createContrastUniform(
            parameters.surfaces.vegetationContrast,
            THERMAL_PERCEPTION_SETTINGS.definition.vegetationPivot,
          ),
          ...createBandUniforms(parameters.bands.vegetation),
          ...HEAT_SENSED,
        },
        vertexHeader: instancedVertexShader,
      }),
    },
    rocks: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_INSTANCED_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createInstancedWarmthUniforms(
            parameters.surfaces.rockWarmth,
            parameters.surfaces.rockWarmthSpread,
            parameters.surfaces.rockHeightWarmthPerMeter,
            parameters.surfaces.rockAxisWarmthPerMeter,
          ),
          ...createTextureUniforms(
            parameters.surfaces.rockTextureWarmth,
            worldFeatureSize,
          ),
          ...createContrastUniform(
            parameters.surfaces.rockContrast,
            THERMAL_PERCEPTION_SETTINGS.definition.rockPivot,
          ),
          ...createBandUniforms(parameters.bands.rocks),
          ...HEAT_SENSED,
        },
        vertexHeader: instancedVertexShader,
      }),
    },
    // One variant per animated mesh: everything but the body matrix is
    // shared, so every actor still answers to a single sense intensity.
    animals: (bodyMatrix) => ({
      applyTo: createPatchApplier({
        cacheKey: THERMAL_ACTOR_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...actorUniforms,
          // A body is already the hottest thing here; it does not radiate
          // onto itself on top of that.
          thermalHeatResponse: { value: 0 },
          thermalActorBodyMatrix: { value: bodyMatrix },
        },
        vertexHeader: actorVertexShader,
      }),
    }),
  };
}

function createPatchApplier(
  variant: Pick<MaterialShaderPatch, "cacheKey" | "uniforms" | "vertexHeader">,
): (material: SensedMaterial) => void {
  return (material) => {
    applyShaderPatch(material, {
      ...variant,
      vertexAnchor: "#include <project_vertex>",
      vertexCall: "passThermalPerception(mvPosition, transformed);",
      fragmentHeader: `${SHADER_DEFINES}\n${fragmentShader}`,
      colorFragmentCall:
        "diffuseColor.rgb = applyThermalPerception(diffuseColor.rgb);",
    });
  };
}

/** Surfaces that answer to nearby warm bodies; a living body does not. */
const HEAT_SENSED = { thermalHeatResponse: { value: 1 } };

/**
 * The live set of warm bodies, held in uniform objects every patched program
 * shares. Bodies are packed as an oriented segment: xyz is the emitting axis
 * centre, w its half length, while the axis vector carries the facing, the
 * reach, and the strength.
 */
function createHeatSourceField(
  emission: ThermalPerceptionParameters["heatEmission"],
) {
  const { maxSources, bodyHalfLengthFraction, coreHeightFraction } =
    THERMAL_PERCEPTION_SETTINGS.heat;
  const bodies = Array.from({ length: maxSources }, () => new Vector4());
  const axes = Array.from({ length: maxSources }, () => new Vector4());
  const count = { value: 0 };

  return {
    uniforms: {
      thermalHeatCount: count,
      thermalHeatBodies: { value: bodies },
      thermalHeatAxes: { value: axes },
    },
    setSources: (sources: readonly ThermalHeatSource[]): void => {
      const sourceCount = Math.min(sources.length, maxSources);
      for (let index = 0; index < sourceCount; index++) {
        const source = sources[index];
        if (!source) continue;

        const { heightMeters } = source;
        bodies[index]?.set(
          source.x,
          source.y + heightMeters * coreHeightFraction,
          source.z,
          heightMeters * bodyHalfLengthFraction,
        );
        // Heading matches the actor's own travel convention (sin, cos), so
        // the pool lies along the body rather than across it.
        axes[index]?.set(
          Math.sin(source.headingRadians),
          Math.cos(source.headingRadians),
          heightMeters * emission.reachPerBodyHeight,
          emission.strength,
        );
      }
      count.value = sourceCount;
    },
  };
}

/** The temperature range one consumer's own substance may occupy. */
function createBandUniforms(band: ThermalWarmthBand) {
  return {
    thermalBand: { value: new Vector2(band.floorWarmth, band.ceilingWarmth) },
    thermalBandKnee: {
      value: THERMAL_PERCEPTION_SETTINGS.bandKneeWarmth,
    },
  };
}

/** How far one consumer's contrast curve is applied, and where it is steepest. */
function createContrastUniform(
  amount: number,
  pivot: number,
): Record<string, { value: Vector2 }> {
  return { thermalContrast: { value: new Vector2(amount, pivot) } };
}

/** Depth and patch size of the organic texture for one consumer. */
function createTextureUniforms(
  textureWarmth: number,
  featureSize: number,
): Record<string, { value: number }> {
  return {
    thermalTextureWarmth: { value: textureWarmth },
    thermalTextureFeatureSize: { value: featureSize },
  };
}

function createInstancedWarmthUniforms(
  baseWarmth: number,
  warmthSpread: number,
  heightWarmthPerMeter: number,
  axisWarmthPerMeter: number,
): Record<string, { value: number }> {
  return {
    thermalBaseWarmth: { value: baseWarmth },
    thermalWarmthSpread: { value: warmthSpread },
    thermalHeightWarmthPerMeter: { value: heightWarmthPerMeter },
    thermalAxisWarmthPerMeter: { value: axisWarmthPerMeter },
    thermalHashCellMeters: {
      value: THERMAL_PERCEPTION_SETTINGS.instanceHashCellMeters,
    },
  };
}

/** Map water depth, elevation, forest, and slope onto one 0..1 warmth. */
function createTerrainWarmthSampler({
  surfaceSettings,
  conditionsAt,
}: ThermalPerceptionOptions): ThermalTerrainEffect["warmthAt"] {
  const { minimumElevation, maximumElevation } =
    getElevationRange(surfaceSettings);
  const elevationSpan = maximumElevation - minimumElevation;
  const warmth = THERMAL_PERCEPTION_SETTINGS.terrainWarmth;

  return (worldX, worldZ, groundYMeters) => {
    const conditions = conditionsAt(worldX, worldZ);
    if (isWater(conditions)) {
      return Math.max(
        0,
        warmth.shorelineWarmth -
          conditions.waterDepthMeters * warmth.waterColdPerDepthMeter,
      );
    }

    const elevationProgress = Math.min(
      Math.max((groundYMeters - minimumElevation) / elevationSpan, 0),
      1,
    );
    const forestBoost =
      Math.min(Math.abs(conditions.forestRegionValue), 1) *
      warmth.forestWarmthBoost;
    const slopeBoost =
      Math.min(conditions.groundSlope, 1) * warmth.slopeWarmthBoost;

    return Math.min(
      1,
      warmth.landWarmthFloor +
        elevationProgress * warmth.landElevationWarmthSpan +
        forestBoost +
        slopeBoost,
    );
  };
}

function validateThermalPerceptionParameters(
  parameters: ThermalPerceptionParameters,
): void {
  const normalizedValues = [
    parameters.intensity,
    parameters.carriedColorBlend,
    parameters.surfaces.vegetationWarmth,
    parameters.surfaces.vegetationWarmthSpread,
    parameters.surfaces.rockWarmth,
    parameters.surfaces.rockWarmthSpread,
    parameters.actorWarmth,
    parameters.actorExtremityFalloff,
    parameters.terrainTextureWarmth,
    parameters.actorTextureWarmth,
    parameters.surfaces.vegetationTextureWarmth,
    parameters.surfaces.rockTextureWarmth,
    parameters.heatEmission.strength,
    parameters.terrainContrast,
    parameters.actorContrast,
    parameters.surfaces.vegetationContrast,
    parameters.surfaces.rockContrast,
    ...Object.values(parameters.bands).flatMap((band) => [
      band.floorWarmth,
      band.ceilingWarmth,
    ]),
  ];
  if (!normalizedValues.every(isNormalized)) {
    throw new RangeError(
      "Thermal intensity and warmth values must be between zero and one",
    );
  }
  // Signed by design: a canopy cools upward while a sunlit rock top warms.
  const gradients = [
    parameters.surfaces.vegetationHeightWarmthPerMeter,
    parameters.surfaces.vegetationAxisWarmthPerMeter,
    parameters.surfaces.rockHeightWarmthPerMeter,
    parameters.surfaces.rockAxisWarmthPerMeter,
  ];
  if (!gradients.every((value) => Number.isFinite(value))) {
    throw new RangeError("Thermal surface gradients must be finite");
  }
  if (
    Object.values(parameters.bands).some(
      (band) => band.floorWarmth >= band.ceilingWarmth,
    )
  ) {
    throw new RangeError(
      "Thermal warmth bands must rise from floor to ceiling",
    );
  }
  if (!isPositiveFinite(parameters.heatEmission.reachPerBodyHeight)) {
    throw new RangeError("Thermal heat reach must be positive and finite");
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
}
