/**
 * Purpose: Turn surface color into the Level 05 heat response inside a viewer radius.
 * Context: Thermal Perception must decorate Terrain, Vegetation, Rocks, and Animals in their passes.
 * Responsibility: Configure shared ramp uniforms, per-consumer warmth, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; colors outside the radius stay theirs.
 */

import { Color, type Matrix4, type MeshBasicMaterial, Vector4 } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import {
  applyShaderPatch,
  type MaterialShaderPatch,
} from "../../utils/asset-loader/material-shader-patch";
import { getElevationRange } from "../../world-surface/height-field";
import type { WorldSurfaceSettings } from "../../world-surface/surface-settings";
import { isWater, type ZoneConditions } from "../../world-surface/zone-field";
import actorVertexShader from "./thermal-actor.vert.glsl?raw";
import instancedVertexShader from "./thermal-instanced.vert.glsl?raw";
import fragmentShader from "./thermal-perception.frag.glsl?raw";
import {
  THERMAL_PERCEPTION_SETTINGS,
  type ThermalPerceptionParameters,
} from "./thermal-perception-settings";
import terrainVertexShader from "./thermal-terrain.vert.glsl?raw";

export type { ThermalPerceptionParameters } from "./thermal-perception-settings";

const THERMAL_TERRAIN_CACHE_KEY = "thermal-terrain-v3";
const THERMAL_INSTANCED_CACHE_KEY = "thermal-instanced-v3";
const THERMAL_ACTOR_CACHE_KEY = "thermal-actor-v3";

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
  // One uniform object each, shared by every patched program, so a future
  // runtime intensity driver reaches all consumers through a single value.
  const sharedUniforms = {
    thermalIntensity: { value: parameters.intensity },
    thermalRadiusMeters: { value: parameters.radiusMeters },
    thermalEdgeFeatherMeters: { value: parameters.edgeFeatherMeters },
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
    terrain: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_TERRAIN_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          ...createTextureUniforms(
            parameters.terrainTextureWarmth,
            worldFeatureSize,
          ),
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
          thermalActorBodyMatrix: { value: bodyMatrix },
        },
        vertexHeader: actorVertexShader,
      }),
    }),
  };
}

function createPatchApplier(
  variant: Pick<MaterialShaderPatch, "cacheKey" | "uniforms" | "vertexHeader">,
): (material: MeshBasicMaterial) => void {
  return (material) => {
    applyShaderPatch(material, {
      ...variant,
      vertexAnchor: "#include <project_vertex>",
      vertexCall: "passThermalPerception(mvPosition, transformed);",
      fragmentHeader: fragmentShader,
      colorFragmentCall:
        "diffuseColor.rgb = applyThermalPerception(diffuseColor.rgb);",
    });
  };
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

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNormalized(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
