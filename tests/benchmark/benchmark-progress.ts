/**
 * Purpose: Describe how far a long benchmark run has come and what is left.
 * Context: A run takes minutes per level, so silence reads as a hang.
 * Responsibility: Turn frame counts and elapsed time into console progress lines.
 * Boundary: Browser driving, artifacts, and baselines live in sibling files.
 */

/** One reading of a level's progress, taken at a known elapsed time. */
export interface ProgressObservation {
  readonly frames: number;
  readonly totalFrames: number;
  readonly elapsedMilliseconds: number;
}

/** The reading a run starts from, before any frame has been reported. */
const RUN_START: ProgressObservation = {
  frames: 0,
  totalFrames: 0,
  elapsedMilliseconds: 0,
};

/**
 * Progress of the level being replayed. The rate comes from the interval
 * between the two readings, so an estimate follows the current speed instead
 * of averaging in the page load that preceded the first frame.
 */
export function describeLevelProgress(
  current: ProgressObservation,
  previous: ProgressObservation = RUN_START,
): string {
  const share =
    current.totalFrames === 0 ? 0 : current.frames / current.totalFrames;
  const parts = [
    `frame ${count(current.frames)}/${count(current.totalFrames)} (${Math.round(share * 100)}%)`,
    `${formatDuration(current.elapsedMilliseconds)} elapsed`,
  ];

  const remaining = estimateRemainingMilliseconds(current, previous);
  if (remaining !== undefined) parts.push(`~${formatDuration(remaining)} left`);
  return parts.join(" · ");
}

/** Undefined while no frames have been observed, because no rate is known yet. */
export function estimateRemainingMilliseconds(
  current: ProgressObservation,
  previous: ProgressObservation = RUN_START,
): number | undefined {
  const frames = current.frames - previous.frames;
  const milliseconds =
    current.elapsedMilliseconds - previous.elapsedMilliseconds;
  if (frames <= 0 || milliseconds <= 0) return undefined;

  const remainingFrames = Math.max(0, current.totalFrames - current.frames);
  return (remainingFrames * milliseconds) / frames;
}

/**
 * Time left for the levels not started yet, estimated from the levels already
 * finished. Undefined until one level has finished, and once none are left.
 */
export function describeRemainingLevels(
  finishedMilliseconds: readonly number[],
  remainingLevelCount: number,
): string | undefined {
  if (finishedMilliseconds.length === 0 || remainingLevelCount <= 0) {
    return undefined;
  }

  const total = finishedMilliseconds.reduce((sum, value) => sum + value, 0);
  const perLevel = total / finishedMilliseconds.length;
  return `~${formatDuration(perLevel * remainingLevelCount)} left for ${remainingLevelCount} level(s)`;
}

/** Compact and rounded: a benchmark ETA is never precise to the second. */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${pad(totalSeconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}
