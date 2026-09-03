/**
 * Purpose: Author the ruined temples the echo world and every later level carry.
 * Context: The ladder carries a structural module forward unchanged once it is introduced.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { RuinsPreset } from "../../modules/ruins/ruins";

export const RUINS: RuinsPreset = {
  /*
   * Test value. Every 128-metre cell of open meadow that stays level under
   * the whole footprint stands a ruin up, which is far more temple than a
   * landscape should hold — it is here so a run-through meets one at all
   * while the placement is being judged. A landmark share is a fraction:
   * around 0.15 is what makes a ruin something you fly toward rather than
   * something you pass.
   */
  standingShare: 1,
  // The stone reads as the pale end of the echo palette: a built thing among
  // the dark trunks, not another rock.
  color: 0x6f6f6f,
};
