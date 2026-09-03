/**
 * Purpose: Define the complete world constructed once for the narrated show.
 * Context: Show states gate one preloaded world instead of rebuilding modules at cues.
 * Responsibility: Name every layer the show's union is made of, plus the haze baked into its materials.
 * Boundary: Presentation, timing, narration, and runtime resources live elsewhere.
 */

import type { ShowComposition } from "./level-preset";
import {
  CONNECTIONS_LAYER,
  ECHO_LAYER,
  MAGNETIC_LAYER,
  MOTION_LAYER,
  SCENT_LAYER,
  THERMAL_LAYER,
  WHITE_WORLD_LAYER,
} from "./sense-layers";

export const SHOW_COMPOSITION: ShowComposition = {
  materialHazeColor: 0xf7f7f7,
  // "Senses layer, never swap": the show is the whole ladder at once, and the
  // schedule gates senses on and off inside it rather than rebuilding.
  world: {
    ...WHITE_WORLD_LAYER,
    ...SCENT_LAYER,
    ...ECHO_LAYER,
    ...MOTION_LAYER,
    ...THERMAL_LAYER,
    ...MAGNETIC_LAYER,
    ...CONNECTIONS_LAYER,
  },
};
