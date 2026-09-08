/**
 * Purpose: Author the snakes the thermal world and every later level carry.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { SnakesPreset } from "../../modules/snakes/snakes";

export const SNAKES: SnakesPreset = {
  /*
   * Test value: a little over half the places the candidate grid offers carry
   * a snake, which is far more snake than a meadow holds — it is here so a
   * run-through finds one while the crawl is being judged. Nine of the
   * sixteen places a 64-metre cell offers is the density the module was
   * tuned at; a quiet landscape is a fraction of it. The ground still refuses
   * most of what survives this draw: water, a bank too steep to follow, and
   * the weight of the ground itself, which keeps the meadow from swallowing
   * the population where nobody can see it.
   */
  crawlingShare: 0.56,
  /*
   * The palette's hot stop, the same one the bird traces take once the heat
   * view is open. A snake takes its warmth from the sun rather than from
   * itself, which is exactly why it lies out in the open to gather it — a
   * basking body is among the warmest things on a meadow, and the one the
   * ground's own cold makes unmistakable.
   */
  color: 0xfb5f16,
};
