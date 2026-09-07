/**
 * Purpose: Provide the monotonic audio clock the show clock derives time from.
 * Context: Browsers keep an AudioContext suspended until a user gesture.
 * Responsibility: Own the AudioContext, its gesture resume, and its release.
 * Boundary: Playback, schedules, and show time are decided elsewhere.
 */

const RESUME_GESTURE_EVENTS = ["pointerdown", "keydown"] as const;

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

/**
 * The audio hardware clock is the timebase; the show clock built on it stays
 * the authority. Deriving show time from this instead of accumulating frame
 * deltas is what keeps a long frame, or a paused XR session, from drifting the
 * show away from the narration it drives.
 */
export function createAudioTimebase(): AudioTimebase {
  const audioContext = new AudioContext();

  let unloading: Promise<void> | undefined;

  function resume(): void {
    if (unloading || audioContext.state === "running") return;
    void audioContext.resume().catch(() => undefined);
  }

  // Keep gestures until unload: a running context can suspend again later.
  for (const eventName of RESUME_GESTURE_EVENTS) {
    window.addEventListener(eventName, resume);
  }

  return {
    readSeconds: () => audioContext.currentTime,

    readState: () => audioContext.state,

    unload(): Promise<void> {
      for (const eventName of RESUME_GESTURE_EVENTS)
        window.removeEventListener(eventName, resume);
      unloading ??= audioContext.close();
      return unloading;
    },
  };
}
