/**
 * Purpose: Author the clipmap grass the echo world and every later level grow.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { GrassClipmapPreset } from "../../modules/grass-clipmap/grass-clipmap";

export const GRASS_CLIPMAP: GrassClipmapPreset = {
  tuftsPerSquareMeter: 21.85,
  fullDensityRadiusMeters: 14,
  bladeHeightMeters: 3,
  bladeWidthMeters: 0.2,
  colors: {
    rootColor: 0x16240c,
    tipColor: 0x94c356,
  },
};
