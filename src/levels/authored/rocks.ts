/**
 * Purpose: Author the rocks the echo world and every later level carry.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { RocksPreset } from "../../modules/rocks/rocks";

export const ROCKS: RocksPreset = {
  colors: {
    darkColor: 0x171717,
    lightColor: 0x494949,
  },
  instancesPerHectareByZone: {
    meadow: 8,
    coniferForest: 10,
    deciduousForest: 10,
    shrubSlope: 60,
  },
};
