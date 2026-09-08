/**
 * Purpose: Keep narration playback matched to the show clock.
 * Context: Seeking must land inside a recording, never restart it.
 * Responsibility: Own the narration audio elements and their full lifecycle.
 * Boundary: Show time and cue selection are decided before this is called.
 */

import {
  type NarrationCueId,
  type NarrationLanguage,
  narrationDurationSeconds,
  narrationUrl,
} from "../dramaturgy/narration-catalog";

// How far playback may sit from the show before it is pulled back. A re-seek
// is audible, so raise this before lowering it. Unmeasured on the PICO.
const SYNC_TOLERANCE_SECONDS = 0.25;

/** One sampled show instant, as the narration needs to see it. */
export interface NarrationFollowState {
  /** Undefined in a gap, before the first cue, and after the show ends. */
  readonly position:
    | { readonly cueId: string; readonly offsetSeconds: number }
    | undefined;
  readonly isPlaying: boolean;
  /** Mirrored onto playback rate, or the correction would fight the clock. */
  readonly timeScale: number;
}

export interface NarrationPlayer {
  readonly follow: (state: NarrationFollowState) => void;
  readonly unload: () => void;
}

/** An approved clip, selected by Show; duration is measured from shipped bytes. */
export interface NarrationRecording {
  readonly cueId: string;
  readonly url: string;
  readonly durationSeconds: number;
}

export type NarrationPlayerOptions =
  | {
      readonly language: NarrationLanguage;
      readonly cueIds: readonly NarrationCueId[];
    }
  | { readonly recordings: readonly NarrationRecording[] };

/** Own only the requested clips, for main-show or interactive tutorial cues. */
export function createNarrationPlayer(
  options: NarrationPlayerOptions,
): NarrationPlayer {
  const recordings =
    "recordings" in options
      ? options.recordings
      : options.cueIds.map((cueId) => ({
          cueId,
          url: narrationUrl(cueId, options.language),
          durationSeconds: narrationDurationSeconds(cueId, options.language),
        }));
  const clips = new Map<
    string,
    { element: HTMLAudioElement; durationSeconds: number }
  >();
  let isUnloaded = false;
  function unload(): void {
    isUnloaded = true;
    const errors: unknown[] = [];
    for (const { element } of clips.values()) {
      try {
        element.pause();
        element.removeAttribute("src");
        element.load();
      } catch (error) {
        errors.push(error);
      }
    }
    clips.clear();
    if (errors.length)
      throw new AggregateError(errors, "Narration cleanup failed");
  }
  try {
    for (const recording of recordings) {
      const element = new Audio(recording.url);
      element.preload = "auto";
      clips.set(recording.cueId, {
        element,
        durationSeconds: recording.durationSeconds,
      });
    }
  } catch (error) {
    try {
      unload();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Narration startup failed",
      );
    }
    throw error;
  }

  let activeCueId: string | undefined;
  let hasReportedBlockedPlayback = false;

  function stopActiveCue(): void {
    if (activeCueId === undefined) return;

    clips.get(activeCueId)?.element.pause();
    activeCueId = undefined;
  }

  function reportBlockedPlayback(): void {
    if (isUnloaded || hasReportedBlockedPlayback) return;

    hasReportedBlockedPlayback = true;
    console.warn("Narration stays blocked until the page receives a gesture.");
  }

  return {
    follow({ position, isPlaying, timeScale }): void {
      // A slot is sized for the longer language, so the shorter recording runs
      // out before its slot does; past that end there is simply silence.
      // Without this the drift correction would seek past the end forever.
      if (isUnloaded) return;
      const clip = position ? clips.get(position.cueId) : undefined;
      if (
        !position ||
        !clip ||
        position.offsetSeconds >= clip.durationSeconds
      ) {
        stopActiveCue();
        return;
      }

      const { element } = clip;

      const isNewCue = position.cueId !== activeCueId;
      if (isNewCue) {
        stopActiveCue();
        activeCueId = position.cueId;
      }

      matchRecording(element, {
        offsetSeconds: position.offsetSeconds,
        isNewCue,
        isPlaying,
        timeScale,
        onBlocked: reportBlockedPlayback,
      });
    },

    unload,
  };
}

interface RecordingMatch {
  readonly offsetSeconds: number;
  /** A fresh cue is always seeked; only a continuing one may be left alone. */
  readonly isNewCue: boolean;
  readonly isPlaying: boolean;
  readonly timeScale: number;
  readonly onBlocked: () => void;
}

/** Bring one recording in line with the instant the show is at. */
function matchRecording(
  element: HTMLAudioElement,
  { offsetSeconds, isNewCue, isPlaying, timeScale, onBlocked }: RecordingMatch,
): void {
  // Mirroring the rate matters: at twice speed an unchanged element would fall
  // behind the clock every frame and stutter under constant correction.
  element.playbackRate = timeScale;

  // Parking a paused element still moves its playhead, so scrubbing while
  // stopped resumes at the word it was scrubbed to.
  if (isNewCue || !isPlaying || isDrifting(element, offsetSeconds)) {
    seekTo(element, offsetSeconds);
  }

  if (!isPlaying) {
    if (!element.paused) element.pause();
    return;
  }
  if (element.paused) void element.play().catch(onBlocked);
}

/** Seeking before metadata arrives is ignored, so a later frame retries. */
function seekTo(element: HTMLAudioElement, offsetSeconds: number): void {
  if (element.readyState < HTMLMediaElement.HAVE_METADATA) return;

  element.currentTime = offsetSeconds;
}

function isDrifting(element: HTMLAudioElement, offsetSeconds: number): boolean {
  return Math.abs(element.currentTime - offsetSeconds) > SYNC_TOLERANCE_SECONDS;
}
