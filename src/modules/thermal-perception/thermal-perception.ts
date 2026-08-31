/**
 * Purpose: Turn surface color into the Level 05 heat response inside a viewer radius.
 * Context: Thermal Perception must decorate Terrain, Vegetation, Rocks, and Animals in their passes.
 * Responsibility: Configure shared ramp uniforms, per-consumer warmth, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; colors outside the radius stay theirs.
 */

import { Color, type MeshBasicMaterial, Vector4 } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
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
  type ThermalPerceptionParameters,
} from "./thermal-perception-settings";
import terrainVertexShader from "./thermal-terrain.vert.glsl?raw";

export type { ThermalPerceptionParameters } from "./thermal-perception-settings";

const THERMAL_TERRAIN_CACHE_KEY = "thermal-terrain-v1";
const THERMAL_INSTANCED_CACHE_KEY = "thermal-instanced-v1";
const THERMAL_ACTOR_CACHE_KEY = "thermal-actor-v1";

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
  readonly animals: UnlitMaterialEffect;
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
  };

  return {
    terrain: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_TERRAIN_CACHE_KEY,
        uniforms: sharedUniforms,
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
          ),
        },
        vertexHeader: instancedVertexShader,
      }),
    },
    animals: {
      applyTo: createPatchApplier({
        cacheKey: THERMAL_ACTOR_CACHE_KEY,
        uniforms: {
          ...sharedUniforms,
          thermalActorWarmth: { value: parameters.actorWarmth },
        },
        vertexHeader: actorVertexShader,
      }),
    },
  };
}

function createPatchApplier(
  variant: Pick<MaterialShaderPatch, "cacheKey" | "uniforms" | "vertexHeader">,
): (material: MeshBasicMaterial) => void {
  return (material) => {
    applyShaderPatch(material, {
      ...variant,
      vertexAnchor: "#include <project_vertex>",
      vertexCall: "passThermalPerception(mvPosition);",
      fragmentHeader: fragmentShader,
      colorFragmentCall:
        "diffuseColor.rgb = applyThermalPerception(diffuseColor.rgb);",
    });
  };
}

function createInstancedWarmthUniforms(
  baseWarmth: number,
  warmthSpread: number,
): Record<string, { value: number }> {
  return {
    thermalBaseWarmth: { value: baseWarmth },
    thermalWarmthSpread: { value: warmthSpread },
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
}
