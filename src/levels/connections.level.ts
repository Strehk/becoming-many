/**
 * Purpose: Define the Connections level preset (the final synthesis, level 07).
 * Context: Connections (level 07) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as magneticLevel } from "./magnetic.level";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Magnetic preset verbatim;
  // every earlier sense stays at full strength while the underground web
  // reveals the relationships between the elements they already show.
  ...magneticLevel,
  // New in level 07: no further biological sense. The moodboard palette
  // #F2E3D3 #683B5A #292E55 #A5BDC3 #D06780 #E39E54 colors the web. A
  // pulsing root web blends over the unchanged carried world, connecting
  // the same deterministic positions the earlier senses source.
  connections: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // The web reaches far past the 30-metre thermal radius and stays
    // within the guaranteed topology-window coverage and the echo haze.
    webRadiusMeters: 88,
    // Slower than the 8 m/s magnetic pulses: nutrients, not signals.
    pulseSpeedMetersPerSecond: 4,
    sources: {
      vegetation: { nodeColor: 0xa5bdc3, weight: 1 },
      scentEmitters: { nodeColor: 0xd06780, weight: 1 },
      animals: { nodeColor: 0xe39e54, weight: 0.5 },
      rocks: { nodeColor: 0x292e55, weight: 0.25 },
    },
    colors: {
      depthColor: 0xffffff, // White: the cord midpoints lighten toward this.
      pulseColor: 0xf2e3d3, // Cream: the traveling light pulses.
    },
  },
};
