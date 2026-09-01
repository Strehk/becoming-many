/**
 * Purpose: Define the Magnetic Field Perception level preset ("Migratory Bird", level 06).
 * Context: Magnetic Field Perception (level 06) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as thermalLevel } from "./thermal.level";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Thermal Perception preset
  // verbatim; the heat view keeps winning on the ground while the magnetic
  // field fills the sky above it, untouched by either.
  ...thermalLevel,
  // New in level 06: the sky of the previous version, ported and hardcoded.
  // The radical-pair shimmer condenses into a tight patch at the magnetic
  // north point and a mirrored one at the southern counter-pole; the module
  // owns every shape and motion value, the preset only the axis and palette.
  magnetic: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    fieldDirectionDegreesFromNorth: 0,
    // The inclination the previous version last had authored.
    fieldElevationDegrees: 7.5,
    colors: {
      // The previous version's authored pole colors: the northern patch reads
      // dark against the pale sky, the southern one nearly dissolves in it.
      northColor: 0x000000,
      southColor: 0xffffff,
      // Its pale blue zenith, as the sRGB hex that converts to the same value.
      zenithColor: 0xc4d7f6,
    },
  },
};
