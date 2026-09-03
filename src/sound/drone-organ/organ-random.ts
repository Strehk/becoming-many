/**
 * Purpose: Give the organ's generative voices randomness that is a function of
 *   the step, not of the moment it was asked.
 * Context: Every note the organ plays must be derivable from show time alone,
 *   so a seek lands on the note playing through would have reached. A random
 *   number generator with state cannot promise that; a hash can.
 * Responsibility: Own the one hash the voices draw from.
 * Boundary: What a value means — a degree, a density roll, a gust — belongs
 *   to the voice that draws it.
 */

const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/**
 * One stable pseudo-random value in [0, 1) for a step of a voice. `channel`
 * separates the different draws one step makes; `salt` separates voices that
 * would otherwise draw the same stream.
 */
export function stepRandom(step: number, channel: number, salt = 0): number {
  let hash = Math.imul(step + 1, 73_856_093);
  hash ^= Math.imul(channel + 1, 19_349_663);
  hash ^= Math.imul(salt + 1, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
