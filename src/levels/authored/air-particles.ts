/**
 * Purpose: Author the air particles every narrative level carries.
 * Context: The neutral depth baseline is present from White World onward and never gated.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { AirParticlesParameters } from "../../modules/air-particles/air-particles";

export const AIR_PARTICLES: AirParticlesParameters = {
  density: {
    particlesPerChunk: 270,
  },
  appearance: {
    color: 0x202126,
    sizeMeters: 0.075,
  },
  motion: {
    horizontalAmplitudeMeters: 0.12,
    verticalAmplitudeMeters: 0.24,
    speedMultiplier: 1,
  },
};
