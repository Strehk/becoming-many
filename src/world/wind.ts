/**
 * Purpose: Define the shared wind used throughout the world.
 * Context: Wind-reactive modules need one consistent direction, strength, and speed.
 * Responsibility: Own the global wind values and the turn they follow over time.
 * Boundary: Animation, rendering, and runtime state remain inside consuming modules.
 */

export const WORLD_WIND = {
  directionXZ: [0.8137, 0.5812], // Sets the mean normalized horizontal X/Z wind direction.
  strength: 0.65, // Scales wind displacement in consuming components.
  speed: 1, // Advances wind animation phases in radians per second.
  swingDegrees: 44, // Widens how far the direction wanders either side of the mean.
  gustVariation: 0.45, // Deepens how much the strength breathes between lulls and gusts.
  loopSeconds: 240, // Bounds the wind clock; every term below is a harmonic of it.
} as const;

/** The wind blowing at one moment: a unit direction and its current strength. */
export interface WorldWindSample {
  readonly directionX: number;
  readonly directionZ: number;
  readonly strength: number;
}

const TAU = Math.PI * 2;
const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Harmonics of the wind loop. Whole multiples keep the wrap seamless, and
 * combining a slow first with a faster third and second makes the turn read
 * as weather rather than as one visible oscillation. The offsets keep the
 * terms from lining up at zero, where the wind would repeatedly settle back
 * onto its mean direction at full strength.
 */
const SWING_SLOW_HARMONIC = 1;
const SWING_FAST_HARMONIC = 3;
const SWING_FAST_SHARE = 0.38;
const SWING_FAST_OFFSET = 1.7;
const GUST_HARMONIC = 2;
const GUST_OFFSET = 0.9;

/**
 * Sample the wind at one moment. This is a pure function of time: the world
 * keeps no wind state, and every consumer that samples the same second gets
 * the same wind. Callers advance their own clock and may wrap it at
 * `loopSeconds`, where the sample repeats exactly.
 */
export function getWorldWind(timeSeconds: number): WorldWindSample {
  const loopPhase = (TAU * timeSeconds) / WORLD_WIND.loopSeconds;
  const swing =
    Math.sin(loopPhase * SWING_SLOW_HARMONIC) +
    SWING_FAST_SHARE *
      Math.sin(loopPhase * SWING_FAST_HARMONIC + SWING_FAST_OFFSET);
  const gust = Math.sin(loopPhase * GUST_HARMONIC + GUST_OFFSET);

  const [meanX, meanZ] = WORLD_WIND.directionXZ;
  const meanRadians = Math.atan2(meanZ, meanX);
  const radians =
    meanRadians + swing * WORLD_WIND.swingDegrees * DEGREES_TO_RADIANS;

  return {
    directionX: Math.cos(radians),
    directionZ: Math.sin(radians),
    strength: WORLD_WIND.strength * (1 + gust * WORLD_WIND.gustVariation),
  };
}

/** Keep a wind clock inside the loop, so long sessions stay exact. */
export function wrapWindSeconds(timeSeconds: number): number {
  return timeSeconds % WORLD_WIND.loopSeconds;
}
