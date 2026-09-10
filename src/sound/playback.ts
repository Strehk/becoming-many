/** One sampled show instant, as the narration needs to see it. */
export interface NarrationFollowState {
  /** Undefined in a gap, before the first cue, and after the show ends. */
  readonly position:
    | { readonly cueId: string; readonly offsetSeconds: number }
    | undefined;
  readonly isPlaying: boolean;
  /** Mirrored onto playback rate, or the correction would fight the clock. */
  readonly timeScale: number;
  /** Tutorial speech finishes natively; authored duration must not cut its tail. */
  readonly preserveNaturalEnd?: boolean;
}

export interface NarrationPlayer {
  readonly follow: (state: NarrationFollowState) => void;
  /** Actual media playback, including blocked, ended and unloaded clips. */
  readonly readIsPlaying: () => boolean;
  /** Native playback observation for spoken-word gates; never advances Show time. */
  readonly readOffsetSeconds: (cueId: string) => number | undefined;
  /** Native completion or terminal playback failure, never a clock estimate. */
  readonly readHasEnded: (cueId: string) => boolean;
  /** Replace the prepared clip set, retaining unchanged recordings without reloading. */
  readonly setRecordings: (recordings: readonly NarrationRecording[]) => void;
  readonly unload: () => void;
}

/** An approved clip, selected by Show; duration is measured from shipped bytes. */
export interface NarrationRecording {
  readonly cueId: string;
  readonly url: string;
  readonly durationSeconds: number;
  /** Authored spoken instruction onset; Show owns its visual presentation. */
  readonly instructionAtSeconds?: number;
  /** Opening room reveal; Show retains the revealed space across later cues. */
  readonly environmentAtSeconds?: number;
}

export interface AudioTimebase {
  /**
   * Stalls while the context is suspended, and that is the intended behavior:
   * if the audio hardware is not running, the show is not advancing either.
   * A headset going to sleep therefore freezes show time instead of letting it
   * run away from the narration.
   */
  readonly readSeconds: () => number;

  /**
   * Whether the hardware clock is actually running. Only a gesture in this
   * window can resume a suspended context, so an operator surface in another
   * window can report the stall but never clear it.
   */
  readonly readState: () => AudioContextState;

  readonly unload: () => Promise<void>;
}
