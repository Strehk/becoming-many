/**
 * Purpose: Turn show time into the steps of one rhythmic grid.
 * Context: The organ has no transport of its own. A step's time is its index
 *   times its length, in show seconds, and the sequencer only answers which
 *   steps fall inside a window just ahead of the playhead.
 * Responsibility: Own the window bookkeeping, and start fresh on a seek.
 * Boundary: What a step does, and how show seconds become audio seconds, is
 *   decided by the caller.
 */

export type StepVisitor = (
  stepIndex: number,
  stepShowTimeSeconds: number,
) => void;

export interface StepSequencer {
  /**
   * Visit every step between what earlier calls already covered and
   * `showTimeSeconds + lookaheadSeconds`. A first call, a seek backward, or a
   * jump past the covered window all start fresh from the playhead: steps
   * are never replayed, and a stall never bunches them up.
   */
  readonly advance: (
    showTimeSeconds: number,
    lookaheadSeconds: number,
    visit: StepVisitor,
  ) => void;

  /** Regrid from the next uncovered instant on; earlier steps stay as fired. */
  readonly setStepSeconds: (stepSeconds: number) => void;

  /** Forget the covered window, so the next advance starts at its playhead. */
  readonly reset: () => void;
}

/** Guards `ceil` against a step landing a rounding error past its own time. */
const GRID_EPSILON = 1e-9;

export function createStepSequencer(initialStepSeconds: number): StepSequencer {
  let stepSeconds = initialStepSeconds;
  let coveredToSeconds = Number.NaN;

  return {
    advance: (showTimeSeconds, lookaheadSeconds, visit): void => {
      const windowEnd = showTimeSeconds + lookaheadSeconds;
      const isFresh =
        Number.isNaN(coveredToSeconds) ||
        showTimeSeconds < coveredToSeconds - lookaheadSeconds ||
        showTimeSeconds > coveredToSeconds;
      if (isFresh) coveredToSeconds = showTimeSeconds;

      // A show never runs before zero; `max` also turns a negative zero into
      // the plain zero a step index is.
      let stepIndex = Math.max(
        0,
        Math.ceil(coveredToSeconds / stepSeconds - GRID_EPSILON),
      );
      for (
        let stepTime = stepIndex * stepSeconds;
        stepTime < windowEnd;
        stepIndex += 1, stepTime = stepIndex * stepSeconds
      ) {
        visit(stepIndex, stepTime);
      }
      coveredToSeconds = windowEnd;
    },

    setStepSeconds: (seconds): void => {
      stepSeconds = seconds;
    },

    reset: (): void => {
      coveredToSeconds = Number.NaN;
    },
  };
}
