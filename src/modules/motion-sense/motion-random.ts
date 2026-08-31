/**
 * Purpose: Provide the Motion Sense module's stateless deterministic randomness.
 * Context: Flies and birds derive all placement and character from integer hashes.
 * Responsibility: Keep the shared hash streams in one place for both actors.
 * Boundary: Simulation, buffers, and materials stay in the files beside this one.
 */

const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/**
 * Return one stable pseudo-random value in [0, 1) without keeping RNG state.
 * Actor-level values leave epoch and attempt at zero; anchor candidates use
 * them for fresh but reproducible re-rolls.
 */
export function getMotionRandom(
  index: number,
  channel: number,
  epoch = 0,
  attempt = 0,
): number {
  let hash = Math.imul(index + 1, 73_856_093);
  hash ^= Math.imul(channel + 1, 19_349_663);
  hash ^= Math.imul(epoch + 1, 2_971_215_073);
  hash ^= Math.imul(attempt + 1, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}

/** Channel offset separating the second hash of one Box-Muller pair. */
const GAUSSIAN_PAIR_CHANNEL_OFFSET = 101;
const TAU = Math.PI * 2;

/**
 * Return one stable standard-normal sample. Placement uses it wherever a
 * natural falloff is wanted: a Gaussian cloud is dense at its centre, thins
 * gradually outward, and has tails instead of an edge.
 */
export function getMotionGaussian(index: number, channel: number): number {
  const unitRadius = Math.max(getMotionRandom(index, channel), Number.EPSILON);
  const unitAngle = getMotionRandom(
    index,
    channel + GAUSSIAN_PAIR_CHANNEL_OFFSET,
  );
  return Math.sqrt(-2 * Math.log(unitRadius)) * Math.cos(TAU * unitAngle);
}

/** Stable stepped noise in [-1, 1) for abrupt per-actor jitter. */
export function getSignedNoise(
  index: number,
  channel: number,
  step: number,
): number {
  let hash =
    Math.imul(index + 1, 374_761_393) ^
    Math.imul(channel + 1, 668_265_263) ^
    Math.imul(step + 1, 1_274_126_177);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x7fff_ffff - 1;
}
