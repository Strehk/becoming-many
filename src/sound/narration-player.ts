/**
 * Purpose: Keep narration playback matched to the show clock.
 * Context: Seeking must land inside a recording, never restart it.
 * Responsibility: Own the narration audio elements and their full lifecycle.
 * Boundary: Show time and cue selection are decided before this is called.
 */

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
  /** Actual media playback, including blocked, ended and unloaded clips. */
  readonly readIsPlaying: () => boolean;
  /** Replace the prepared clip set, retaining unchanged recordings without reloading. */
  readonly setRecordings: (recordings: readonly NarrationRecording[]) => void;
  readonly unload: () => void;
}

/** An approved clip, selected by Show; duration is measured from shipped bytes. */
export interface NarrationRecording {
  readonly cueId: string;
  readonly url: string;
  readonly durationSeconds: number;
}

/** Own the prepared clips and play only the cue selected by Show. */
export function createNarrationPlayer(options: {
  readonly recordings: readonly NarrationRecording[];
}): NarrationPlayer {
  const clips = new Map<
    string,
    { element: HTMLAudioElement; url: string; durationSeconds: number }
  >();
  let activeCueId: string | undefined;
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

    clips.get(activeCueId)?.element.pause();
    activeCueId = undefined;
  }

  function reportBlockedPlayback(): void {
    if (isUnloaded || hasReportedBlockedPlayback) return;

    hasReportedBlockedPlayback = true;
    console.warn("Narration stays blocked until the page receives a gesture.");
  }

  return {
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

    setRecordings,
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
