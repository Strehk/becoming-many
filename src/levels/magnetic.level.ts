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
  // verbatim; the heat view keeps winning inside its 30 m radius while the
  // magnetic ground lines print over the echo ramp outside it.
  ...thermalLevel,
  // New in level 06: the moodboard palette #151935 #1140A4 #69BDE1 #CDDBE2
  // #A394C3 #F9B33C colors the field. Deep blue carries the ground lines and
  // the northern sky glow; the pale gray-blue carries the traveling pulses.
  // Line dimensions start from the proven Test Level diagnostic values and
  // remain tunable against real headset contrast.
  magnetic: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    fieldDirectionDegreesFromNorth: 0,
    lineSpacingMeters: 8,
    lineWidthMeters: 0.35,
    pulseWidthMeters: 0.1,
    lineOpacity: 0.2,
    flowSpeedMetersPerSecond: 8,
    colors: {
      lineColor: 0x1140a4,
      pulseColor: 0xcddbe2,
      skyGlowColor: 0x1140a4,
    },
  },
};
