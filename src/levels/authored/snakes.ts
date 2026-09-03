/**
 * Purpose: Author the snakes the echo world and every later level carry.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { SnakesPreset } from "../../modules/snakes/snakes";

export const SNAKES: SnakesPreset = {
  /*
   * Thirty places offered per 64-metre cell. Most are refused: by water, by a
   * bank too steep to follow, and by the weight of the ground itself, which
   * keeps the meadow from swallowing most of the population where nobody can
   * see it. What is left is a handful crossing the country around a visitor
   * at any moment — met now and then rather than everywhere underfoot.
   */
  candidatesPerCell: 30,
  /*
   * Test value: every place the ground accepts carries a snake, which is far
   * more snake than a meadow holds — it is here so a run-through finds one
   * while the crawl is being judged. A quiet landscape is a fraction of this.
   */
  crawlingShare: 1,
  /*
   * The palette's hot stop, the same one the bird traces take once the heat
   * view is open. A snake takes its warmth from the sun rather than from
   * itself, which is exactly why it lies out in the open to gather it — a
   * basking body is among the warmest things on a meadow, and the one the
   * ground's own cold makes unmistakable.
   */
  color: 0xfb5f16,
};
