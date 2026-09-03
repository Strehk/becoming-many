/**
 * Purpose: Author the echo depth ramp every echo-carrying level and the show share.
 * Context: The ladder carries a sense forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { EchoDepthParameters } from "../../modules/echo-depth/echo-depth";

export const ECHO_DEPTH: EchoDepthParameters = {
  intensity: 1,
  nearDistanceMeters: 6,
  farDistanceMeters: 96,
  colors: {
    nearColor: 0x101010,
    nearShadeColor: 0x494949,
    midColor: 0x959595,
    farColor: 0xe2e2e2,
    hazeColor: 0xf7f7f7,
  },
};
