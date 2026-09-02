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
import type { NarrationCuePosition } from "../dramaturgy/narration-schedule";

// How far playback may sit from the show before it is pulled back. A re-seek
// is audible, so raise this before lowering it. Unmeasured on the PCVR path.
const SYNC_TOLERANCE_SECONDS = 0.25;

/** One sampled show instant, as the narration needs to see it. */
export interface NarrationFollowState {
  /** Undefined in a gap, before the first cue, and after the show ends. */
  readonly position: NarrationCuePosition | undefined;
  readonly isPlaying: boolean;
  /** Mirrored onto playback rate, or the correction would fight the clock. */
  readonly timeScale: number;
}

export interface NarrationPlayer {
  readonly follow: (state: NarrationFollowState) => void;
  readonly unload: () => void;
}

export interface NarrationPlayerOptions {
  readonly language: NarrationLanguage;
  /** Only these recordings are fetched; one fixed element each. */
  readonly cueIds: readonly NarrationCueId[];
}

export function createNarrationPlayer({
  language,
  cueIds,
}: NarrationPlayerOptions): NarrationPlayer {
  const elements = new Map<NarrationCueId, HTMLAudioElement>();
  for (const cueId of cueIds) {
    elements.set(cueId, createCueElement(cueId, language));
  }

  let activeCueId: NarrationCueId | undefined;
  let hasReportedBlockedPlayback = false;

  function stopActiveCue(): void {
    if (activeCueId === undefined) return;

    elements.get(activeCueId)?.pause();
    activeCueId = undefined;
  }

  function reportBlockedPlayback(): void {
    if (hasReportedBlockedPlayback) return;

    hasReportedBlockedPlayback = true;
    console.warn("Narration stays blocked until the page receives a gesture.");
  }

  return {
    follow({ position, isPlaying, timeScale }): void {
      // A slot is sized for the longer language, so the shorter recording runs
      // out before its slot does; past that end there is simply silence.
      // Without this the drift correction would seek past the end forever.
      if (!position || hasPlayedOut(position, language)) {
        stopActiveCue();
        return;
      }

      const element = elements.get(position.cueId);
      if (!element) return;

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

    unload(): void {
      for (const element of elements.values()) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
      elements.clear();
      activeCueId = undefined;
    },
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

function createCueElement(
  cueId: NarrationCueId,
  language: NarrationLanguage,
): HTMLAudioElement {
  const element = new Audio(narrationUrl(cueId, language));
  // Buffering the session's own language up front — about 7.4 MB across eight
  // recordings — keeps a seek into any of them instant, which is the point of
  // scrubbing. The element streams; it is never decoded to PCM.
  element.preload = "auto";

  return element;
}

function hasPlayedOut(
  position: NarrationCuePosition,
  language: NarrationLanguage,
): boolean {
  return (
    position.offsetSeconds >= narrationDurationSeconds(position.cueId, language)
  );
}

/** Seeking before metadata arrives is ignored, so a later frame retries. */
function seekTo(element: HTMLAudioElement, offsetSeconds: number): void {
  if (element.readyState < HTMLMediaElement.HAVE_METADATA) return;

  element.currentTime = offsetSeconds;
}

function isDrifting(element: HTMLAudioElement, offsetSeconds: number): boolean {
  return Math.abs(element.currentTime - offsetSeconds) > SYNC_TOLERANCE_SECONDS;
}
