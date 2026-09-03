/**
 * Purpose: Author the snakes the echo world and every later level carry.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { SnakesPreset } from "../../modules/snakes/snakes";

export const SNAKES: SnakesPreset = {
  /*
   * Ten places offered per 64-metre cell. The ground refuses every one that
   * would lay a body through a wood or down a bank, so what is left is the
   * open country carrying as much snake as it can hold — a test value, and a
   * deliberately loud one.
   */
  candidatesPerCell: 10,
  /*
   * Test value: every place the ground accepts carries a snake, which is far
   * more snake than a meadow holds — it is here so a run-through finds one
   * while the crawl is being judged. A quiet landscape is a fraction of this.
   */
  crawlingShare: 1,
  // Darker than the grass it crosses and lighter than a trunk, so a body
  // moving through the meadow is read as movement rather than as shadow.
  color: 0x2b2b2b,
};
