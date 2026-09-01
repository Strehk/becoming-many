/**
 * Purpose: Own the one virtual show time the whole piece is timed against.
 * Context: Rehearsal must pause, seek, and rescale the show without restarting it.
 * Responsibility: Derive show seconds from an injected monotonic timebase.
 * Boundary: Audio files, senses, levels, and rendering stay unknown here.
 */

import { isPositiveFinite } from "../utils/number-ranges";

/** One coherent read of show state, taken once per frame. */
export interface ShowTimeSample {
  /** Position in the show; what every follower matches itself to. */
  readonly timeSeconds: number;
  /** False while paused, so followers hold instead of advancing. */
  readonly isPlaying: boolean;
  /** Playback rate carried to followers; 1 is real time. */
  readonly timeScale: number;
}

/** The transport. One clock exists per running show. */
export interface ShowClock {
  /**
   * Read the current instant. The timebase keeps advancing while a frame is
   * built, so sampling once and sharing the result keeps every follower on the
   * same instant.
   */
  readonly sample: () => ShowTimeSample;
  readonly play: () => void;
  readonly pause: () => void;
  /** Absolute seek, clamped to the show length. */
  readonly seekTo: (showTimeSeconds: number) => void;
  /** Relative seek: the scrub primitive. */
  readonly seekBy: (offsetSeconds: number) => void;
  /** Rebases before changing rate, so the playhead never jumps. */
  readonly setTimeScale: (timeScale: number) => void;
}

/**
 * Show time is derived from the timebase rather than accumulated per frame, so
 * a dropped or long frame cannot make the show drift away from the audio it
 * drives. The clock starts paused at zero; nothing plays until `play()`.
 */
export function createShowClock(
  durationSeconds: number,
  readTimebaseSeconds: () => number,
): ShowClock {
  if (!isPositiveFinite(durationSeconds)) {
    throw new RangeError(
      `Show duration must be positive and finite, received ${durationSeconds}`,
    );
  }

  let showSecondsAtOrigin = 0;
  let originTimebaseSeconds = readTimebaseSeconds();
  let timeScale = 1;
  let isPlaying = false;

  function currentShowSeconds(): number {
    if (!isPlaying) return showSecondsAtOrigin;

    const elapsedSeconds =
      (readTimebaseSeconds() - originTimebaseSeconds) * timeScale;
    return clampToShow(showSecondsAtOrigin + elapsedSeconds, durationSeconds);
  }

  /** Make the current instant the new origin so a change cannot move it. */
  function rebase(): void {
    showSecondsAtOrigin = currentShowSeconds();
    originTimebaseSeconds = readTimebaseSeconds();
  }

  function seekTo(showTimeSeconds: number): void {
    if (!Number.isFinite(showTimeSeconds)) {
      throw new RangeError(
        `Seek target must be finite, received ${showTimeSeconds}`,
      );
    }

    showSecondsAtOrigin = clampToShow(showTimeSeconds, durationSeconds);
    originTimebaseSeconds = readTimebaseSeconds();
  }

  return {
    sample: () => ({
      timeSeconds: currentShowSeconds(),
      isPlaying,
      timeScale,
    }),

    play(): void {
      rebase();
      isPlaying = true;
    },

    pause(): void {
      rebase();
      isPlaying = false;
    },

    seekTo,

    seekBy(offsetSeconds): void {
      seekTo(currentShowSeconds() + offsetSeconds);
    },

    setTimeScale(nextTimeScale): void {
      if (!isPositiveFinite(nextTimeScale)) {
        throw new RangeError(
          `Time scale must be positive and finite, received ${nextTimeScale}`,
        );
      }

      rebase();
      timeScale = nextTimeScale;
    },
  };
}

function clampToShow(showTimeSeconds: number, durationSeconds: number): number {
  if (showTimeSeconds < 0) return 0;
  if (showTimeSeconds > durationSeconds) return durationSeconds;
  return showTimeSeconds;
}
