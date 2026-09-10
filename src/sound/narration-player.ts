/**
 * Purpose: Keep narration playback matched to the show clock.
 * Context: Seeking must land inside a recording, never restart it.
 * Responsibility: Own the narration audio elements and their full lifecycle.
 * Boundary: Show time and cue selection are decided before this is called.
 */

// How far playback may sit from the show before it is pulled back. A re-seek
// is audible, so raise this before lowering it. Unmeasured on the PICO.
const SYNC_TOLERANCE_SECONDS = 0.25;

import type { NarrationPlayer, NarrationRecording } from "./playback";

interface PreparedNarration {
  readonly element: HTMLAudioElement;
  readonly url: string;
  durationSeconds: number;
  /** Last requested native seek, retained only during Hold (getters may round). */
  heldSeekSeconds?: number;
  /** At most one pending/rejected play attempt until a new transport/cue intent. */
  playAttempt?: Promise<void>;
  playbackFailed?: boolean;
  requestedOffsetSeconds?: number;
  pendingStartSeconds?: number;
}

/** Own the prepared clips and play only the cue selected by Show. */
export function createNarrationPlayer(options: {
  readonly recordings: readonly NarrationRecording[];
}): NarrationPlayer {
  const clips = new Map<string, PreparedNarration>();
  let activeCueId: string | undefined;
  let isUnloaded = false;
  function unload(): void {
    isUnloaded = true;
    const errors: unknown[] = [];
    for (const clip of clips.values()) {
      const { element } = clip;
      clip.playAttempt = undefined;
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
  function setRecordings(recordings: readonly NarrationRecording[]): void {
    if (isUnloaded) return;
    try {
      stopActiveCue();
      for (const [cueId, clip] of clips) {
        if (
          recordings.some(
            (recording) =>
              recording.cueId === cueId && recording.url === clip.url,
          )
        )
          continue;
        clip.element.pause();
        clip.element.removeAttribute("src");
        clip.element.load();
        clips.delete(cueId);
      }
      for (const recording of recordings) {
        const existing = clips.get(recording.cueId);
        if (existing) {
          existing.durationSeconds = recording.durationSeconds;
          continue;
        }
        const element = new Audio(recording.url);
        element.preload = "auto";
        clips.set(recording.cueId, {
          element,
          url: recording.url,
          durationSeconds: recording.durationSeconds,
        });
      }
    } catch (error) {
      try {
        unload();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Narration preparation failed",
        );
      }
      throw error;
    }
  }
  setRecordings(options.recordings);

  let hasReportedBlockedPlayback = false;

  function stopActiveCue(): void {
    if (activeCueId === undefined) return;

    const clip = clips.get(activeCueId);
    if (clip) {
      clip.playAttempt = undefined;
      clip.heldSeekSeconds = undefined;
      clip.requestedOffsetSeconds = undefined;
      clip.pendingStartSeconds = undefined;
      clip.playbackFailed = false;
      clip.element.pause();
    }
    activeCueId = undefined;
  }

  function reportBlockedPlayback(): void {
    if (isUnloaded || hasReportedBlockedPlayback) return;

    hasReportedBlockedPlayback = true;
    console.warn("Narration playback failed; use Pause then Play to retry.");
  }

  return {
    readHasEnded(cueId): boolean {
      const clip = clips.get(cueId);
      return Boolean(
        !clip ||
          clip.element.ended ||
          clip.element.error ||
          clip.playbackFailed,
      );
    },
    readOffsetSeconds(cueId) {
      return !isUnloaded && activeCueId === cueId
        ? clips.get(cueId)?.element.currentTime
        : undefined;
    },
    readIsPlaying(): boolean {
      const element = activeCueId ? clips.get(activeCueId)?.element : undefined;
      return Boolean(
        !isUnloaded &&
          element &&
          !element.paused &&
          !element.ended &&
          element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      );
    },
    follow({
      position,
      isPlaying,
      timeScale,
      preserveNaturalEnd = false,
    }): void {
      // A slot is sized for the longer language, so the shorter recording runs
      // out before its slot does; past that end there is simply silence.
      // Without this the drift correction would seek past the end forever.
      if (isUnloaded) return;
      const clip = position ? clips.get(position.cueId) : undefined;
      if (
        !position ||
        !clip ||
        (!preserveNaturalEnd && position.offsetSeconds >= clip.durationSeconds)
      ) {
        stopActiveCue();
        return;
      }

      const isNewCue = position.cueId !== activeCueId;
      if (isNewCue) {
        stopActiveCue();
        activeCueId = position.cueId;
      }

      const { offsetSeconds } = position;
      const { element } = clip;
      const restarting =
        preserveNaturalEnd &&
        clip.requestedOffsetSeconds !== undefined &&
        offsetSeconds + SYNC_TOLERANCE_SECONDS < clip.requestedOffsetSeconds;
      clip.requestedOffsetSeconds = offsetSeconds;
      if (preserveNaturalEnd && (isNewCue || restarting))
        clip.pendingStartSeconds = offsetSeconds;
      if (preserveNaturalEnd && element.ended && !isNewCue && !restarting)
        return;
      if (element.playbackRate !== timeScale) element.playbackRate = timeScale;

      const needsPosition =
        isNewCue ||
        restarting ||
        clip.pendingStartSeconds !== undefined ||
        (!preserveNaturalEnd &&
          (!isPlaying ||
            Math.abs(element.currentTime - offsetSeconds) >
              SYNC_TOLERANCE_SECONDS));
      if (
        needsPosition &&
        element.readyState >= HTMLMediaElement.HAVE_METADATA &&
        (isPlaying || clip.heldSeekSeconds !== offsetSeconds)
      ) {
        const seekSeconds = clip.pendingStartSeconds ?? offsetSeconds;
        if (element.currentTime !== seekSeconds)
          element.currentTime = seekSeconds;
        clip.heldSeekSeconds = seekSeconds;
        clip.pendingStartSeconds = undefined;
      }

      if (!isPlaying) {
        if (!element.paused || clip.playAttempt) element.pause();
        clip.playAttempt = undefined;
        clip.playbackFailed = false;
        return;
      }
      clip.heldSeekSeconds = undefined;
      if (!element.paused || clip.playAttempt) return;
      const attempt = element.play();
      clip.playAttempt = attempt;
      void attempt.then(
        () => {
          if (clip.playAttempt === attempt) clip.playAttempt = undefined;
        },
        () => {
          // A pause, cue switch or unload can cancel an older pending attempt.
          // A rejected current intent stays latched, rather than retrying per frame.
          if (clip.playAttempt === attempt) {
            clip.playbackFailed = true;
            reportBlockedPlayback();
          }
        },
      );
    },

    setRecordings,
    unload,
  };
}
