/**
 * Purpose: Author the magnetic sense Magnetic Sense and Connections share with the show.
 * Context: The ladder carries a sense forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { MagneticSenseParameters } from "../../modules/magnetic-sense/magnetic-sense";

export const MAGNETIC_SENSE: MagneticSenseParameters = {
  intensity: 1,
  fieldDirectionDegreesFromNorth: 0,
  fieldElevationDegrees: 7.5,
  colors: {
    northColor: 0x000000,
    southColor: 0xffffff,
    zenithColor: 0xc4d7f6,
  },
};
