/**
 * Purpose: Author the vegetation the echo world and every later level grow.
 * Context: Scent places invisible plants where these visible ones will stand, so both read one placement.
 * Responsibility: Own the one copy of these values and the placement they share with Scent.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { StaticPopulationPreset } from "../../modules/static-population";
import type { VegetationPreset } from "../../modules/vegetation/vegetation";

/** Where plants stand, visible or not: Scent's trails rise from the same spots. */
export const VEGETATION_PLACEMENT: StaticPopulationPreset["instancesPerHectareByZone"] =
  {
    meadow: 12,
    coniferForest: 150,
    deciduousForest: 150,
    shrubSlope: 70,
  };

export const VEGETATION: VegetationPreset = {
  colors: {
    trunkColor: 0x101010,
    leafColor: 0x171717,
    leafAccentColor: 0x494949,
    flowerColor: 0x959595,
  },
  instancesPerHectareByZone: VEGETATION_PLACEMENT,
};
