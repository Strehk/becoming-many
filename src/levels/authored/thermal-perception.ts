/**
 * Purpose: Author the thermal perception Thermal Perception and every later level carry.
 * Context: The ladder carries a sense forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { ThermalPerceptionParameters } from "../../modules/thermal-perception/thermal-perception";

export const THERMAL_PERCEPTION: ThermalPerceptionParameters = {
  intensity: 1,
  radiusMeters: 35,
  edgeFeatherMeters: 12,
  carriedColorBlend: 0.42,
  colors: {
    coldestColor: 0x0e0628,
    coldColor: 0x072b7d,
    coolColor: 0x1c6c8b,
    warmColor: 0xd5198a,
    hotColor: 0xfb5f16,
    hottestColor: 0xfcce43,
  },
  surfaces: {
    vegetationWarmth: 0.76,
    vegetationWarmthSpread: 0.05,
    vegetationHeightWarmthPerMeter: -0.06,
    vegetationAxisWarmthPerMeter: -0.11,
    vegetationTextureWarmth: 0.26,
    vegetationContrast: 0.34,
    undergrowthWarmth: 0.42,
    undergrowthWarmthSpread: 0.07,
    undergrowthHeightWarmthPerMeter: -0.09,
    undergrowthAxisWarmthPerMeter: -0.16,
    undergrowthTextureWarmth: 0.28,
    undergrowthContrast: 0.5,
    rockWarmth: 0.2,
    rockWarmthSpread: 0.18,
    rockHeightWarmthPerMeter: 0.05,
    rockAxisWarmthPerMeter: -0.03,
    rockTextureWarmth: 0.24,
    rockContrast: 0.52,
    grassWarmth: 0.34,
    grassTextureWarmth: 0.28,
    grassContrast: 0.5,
  },
  bands: {
    terrain: {
      floorWarmth: 0,
      ceilingWarmth: 0.48,
    },
    vegetation: {
      floorWarmth: 0.16,
      ceilingWarmth: 0.82,
    },
    undergrowth: {
      floorWarmth: 0,
      ceilingWarmth: 0.6,
    },
    rocks: {
      floorWarmth: 0,
      ceilingWarmth: 0.48,
    },
    grass: {
      floorWarmth: 0,
      ceilingWarmth: 0.54,
    },
    animals: {
      floorWarmth: 0.72,
      ceilingWarmth: 1,
    },
  },
  terrainTextureWarmth: 0.28,
  terrainContrast: 0.7,
  actorWarmth: 0.96,
  actorExtremityFalloff: 0.2,
  actorTextureWarmth: 0.07,
  actorContrast: 0.3,
  heatEmission: {
    strength: 0.05,
    reachPerBodyHeight: 1.2,
  },
};
