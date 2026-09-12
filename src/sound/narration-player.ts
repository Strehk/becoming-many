/**
 * Purpose: Keep narration playback matched to the show clock.
 * Context: Seeking must land inside a recording, never restart it.
 * Responsibility: Own the narration audio elements and their full lifecycle.
 * Boundary: Show time and cue selection are decided before this is called.
 */

// How far playback may sit from the show before it is pulled back. A re-seek
// is audible, so raise this before lowering it. Unmeasured on the PICO.
const SYNC_TOLERANCE_SECONDS = 0.25;
const REPLACEMENT_SEEK_LIMIT = 2;

import type {
  NarrationFollowState,
  NarrationPlayer,
  NarrationRecording,
} from "./playback";

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
  /** Initial position and one final alignment; slow seeks must still converge. */
  replacementSeeks?: number;
}

/** Own the prepared clips and play only the cue selected by Show. */
export function createNarrationPlayer(options: {
  readonly recordings: readonly NarrationRecording[];
}): NarrationPlayer {
  const clips = new Map<string, PreparedNarration>();
  let activeCueId: string | undefined;
  let activeClip: PreparedNarration | undefined;
  let isUnloaded = false;
  function unload(): void {
    isUnloaded = true;
    const errors: unknown[] = [];
    for (const clip of new Set([...clips.values(), activeClip])) {
      if (!clip) continue;
      try {
        releaseClip(clip);
      } catch (error) {
        errors.push(error);
      }
    }
    clips.clear();
    activeClip = undefined;
    if (errors.length)
      throw new AggregateError(errors, "Narration cleanup failed");
  }
  function setRecordings(recordings: readonly NarrationRecording[]): void {
    if (isUnloaded) return;
    try {
      for (const [cueId, clip] of clips) {
        if (
          recordings.some(
            (recording) =>
              recording.cueId === cueId && recording.url === clip.url,
          )
        )
          continue;
        if (clip !== activeClip) releaseClip(clip);
        clips.delete(cueId);
      }
      for (const recording of recordings) {
        const existing =
          clips.get(recording.cueId) ??
          (activeCueId === recording.cueId && activeClip?.url === recording.url
            ? activeClip
            : undefined);
        if (existing) {
          existing.durationSeconds = recording.durationSeconds;
          clips.set(recording.cueId, existing);
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
    const candidate = clips.get(activeCueId);
    if (candidate && candidate !== activeClip) stopClip(candidate);
    if (activeClip) {
      stopClip(activeClip);
      if (candidate !== activeClip) releaseClip(activeClip);
    }
    activeClip = undefined;
    activeCueId = undefined;
  }

  function stopClip(clip: PreparedNarration): void {
    clip.playAttempt = undefined;
    clip.heldSeekSeconds = undefined;
    clip.requestedOffsetSeconds = undefined;
    clip.pendingStartSeconds = undefined;
    clip.replacementSeeks = undefined;
    clip.playbackFailed = false;
    clip.element.pause();
  }

  function releaseClip(clip: PreparedNarration): void {
    clip.playAttempt = undefined;
    clip.element.pause();
    clip.element.removeAttribute("src");
    clip.element.load();
  }

  function reportBlockedPlayback(): void {
    if (isUnloaded || hasReportedBlockedPlayback) return;

    hasReportedBlockedPlayback = true;
    console.warn("Narration playback failed; use Pause then Play to retry.");
  }

  return {
    readHasEnded(cueId): boolean {
      const clip = activeCueId === cueId ? activeClip : clips.get(cueId);
      return Boolean(
        !clip ||
          clip.element.ended ||
          clip.element.error ||
          clip.playbackFailed,
      );
    },
    readOffsetSeconds(cueId) {
      return !isUnloaded && activeCueId === cueId
        ? activeClip?.element.currentTime
        : undefined;
    },
    readIsPlaying(): boolean {
      const element = activeClip?.element;
      return Boolean(
        !isUnloaded &&
          element &&
          !element.paused &&
          !element.ended &&
          element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      );
    },
    follow(state): void {
      const { position, isPlaying, preserveNaturalEnd = false } = state;
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
        activeClip = clip;
        clip.element.muted = false;
      }
      if (activeClip && activeClip !== clip) {
        followClip(activeClip, state, false);
        clip.element.muted = true;
      }
      followClip(clip, state, isNewCue);
      promoteReplacement(clip, isPlaying);
    },

    setRecordings,
    unload,
  };

  function promoteReplacement(
    clip: PreparedNarration,
    isPlaying: boolean,
  ): void {
    if (
      activeClip === clip ||
      clip.element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      clip.element.seeking ||
      clip.element.error ||
      clip.playbackFailed ||
      (isPlaying && (clip.element.paused || clip.playAttempt))
    )
      return;
    if (activeClip) releaseClip(activeClip);
    activeClip = clip;
    clip.replacementSeeks = undefined;
    clip.element.muted = false;
  }

  /** Follow the same Show instant for both sources until the replacement can take over. */
  function followClip(
    clip: PreparedNarration,
    state: NarrationFollowState,
    isNewCue: boolean,
  ): void {
    const { position, timeScale, preserveNaturalEnd = false } = state;
    if (!position) return;
    const { offsetSeconds } = position;
    const { element } = clip;
    if (!preserveNaturalEnd && offsetSeconds >= clip.durationSeconds) {
      if (!element.paused || clip.playAttempt) stopClip(clip);
      return;
    }
    const restarting =
      preserveNaturalEnd &&
      clip.requestedOffsetSeconds !== undefined &&
      offsetSeconds + SYNC_TOLERANCE_SECONDS < clip.requestedOffsetSeconds;
    clip.requestedOffsetSeconds = offsetSeconds;
    if (preserveNaturalEnd && (isNewCue || restarting))
      clip.pendingStartSeconds = offsetSeconds;
    if (preserveNaturalEnd && element.ended && !isNewCue && !restarting) return;
    if (element.playbackRate !== timeScale) element.playbackRate = timeScale;
    followPosition(clip, state, isNewCue || restarting);
    followPlayback(clip, state.isPlaying);
  }

  function followPosition(
    clip: PreparedNarration,
    { position, isPlaying, preserveNaturalEnd = false }: NarrationFollowState,
    restarting: boolean,
  ): void {
    if (!position) return;
    const { offsetSeconds } = position;
    const { element } = clip;
    if (activeClip !== clip && isPlaying && !canPositionReplacement(clip))
      return;
    const needsPosition =
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
      if (activeClip !== clip)
        clip.replacementSeeks = (clip.replacementSeeks ?? 0) + 1;
    }
  }

  function canPositionReplacement(clip: PreparedNarration): boolean {
    if (clip.element.seeking) return false;
    if (!clip.replacementSeeks) return true;
    return (
      clip.replacementSeeks < REPLACEMENT_SEEK_LIMIT &&
      !clip.playAttempt &&
      !clip.element.paused
    );
  }

  function followPlayback(clip: PreparedNarration, isPlaying: boolean): void {
    const { element } = clip;
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
  }
}
