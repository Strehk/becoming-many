/**
 * Purpose: Author the scent particles every scent-carrying level and the show share.
 * Context: The ladder carries a sense forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { ScentParticlesParameters } from "../../modules/scent-particles/scent-particles";

export const SCENT_PARTICLES: ScentParticlesParameters = {
  plants: {
    conifer: {
      color: 0x55d1ba,
      particlesPerPlant: 84,
      emissionBottomFraction: 0.25,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.34,
      riseHeightMeters: 2.2,
    },
    deciduous: {
      color: 0x6adadd,
      particlesPerPlant: 84,
      emissionBottomFraction: 0.45,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.46,
      riseHeightMeters: 2.2,
    },
    birch: {
      color: 0xb185c2,
      particlesPerPlant: 72,
      emissionBottomFraction: 0.5,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.38,
      riseHeightMeters: 2,
    },
    bush: {
      color: 0x50be81,
      particlesPerPlant: 40,
      emissionBottomFraction: 0.1,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.85,
      riseHeightMeters: 0.7,
    },
    floweringBush: {
      color: 0xa865c7,
      particlesPerPlant: 52,
      emissionBottomFraction: 0.1,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.95,
      riseHeightMeters: 0.9,
    },
    deadWood: {
      color: 0xb2a17f,
      particlesPerPlant: 18,
      emissionBottomFraction: 0.2,
      emissionTopFraction: 0.9,
      emissionRadiusFraction: 0.28,
      riseHeightMeters: 0.5,
    },
  },
  animals: {
    signatures: {
      deer: {
        color: 0xfdbb54,
      },
      stag: {
        color: 0xef8f3c,
      },
      fox: {
        color: 0xfda39d,
      },
      rat: {
        color: 0xd8919c,
      },
    },
    printsPerSecond: 20,
    lifetimeSeconds: 25,
    emissionBottomFraction: 0.15,
    emissionTopFraction: 0.85,
    emissionRadiusFraction: 0.35,
    riseHeightMeters: 0.8,
    windResponseMeters: 4,
  },
  appearance: {
    sizeMeters: 0.16,
  },
  motion: {
    riseDurationSeconds: 10,
    driftAmplitudeMeters: 1.3,
    speedMultiplier: 1,
    windResponseMeters: 7,
  },
};
