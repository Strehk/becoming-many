/**
 * Purpose: Author the visible terrain the echo world and every later level stand on.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { TerrainPreset } from "../level-preset";

export const ZONE_TERRAIN: TerrainPreset = {
  opacity: 1,
};
