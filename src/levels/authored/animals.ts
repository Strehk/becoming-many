/**
 * Purpose: Author the warm animal bodies Thermal Perception and every later level carry.
 * Context: The ladder carries a sense forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { AnimalsPreset } from "../../modules/animals/animals";

export const WARM_ANIMALS: AnimalsPreset = {
  colors: {
    furColor: 0x171717,
    lightFurColor: 0x494949,
    darkFurColor: 0x101010,
    featureColor: 0x101010,
  },
};
