/**
 * Purpose: Provide the monotonic audio clock the show clock derives time from.
 * Context: Browsers keep an AudioContext suspended until a user gesture.
 * Responsibility: Own the AudioContext, its gesture resume, and its release.
 * Boundary: Playback, schedules, and show time are decided elsewhere.
 */

const RESUME_GESTURE_EVENTS = ["pointerdown", "keydown"] as const;

import type { AudioTimebase } from "./playback";

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
