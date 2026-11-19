/**
 * Purpose: Provide the monotonic audio clock the show clock derives time from.
 * Context: Browsers keep an AudioContext suspended until a user gesture.
 * Responsibility: Own the AudioContext, its gesture resume, and its release.
 * Boundary: Playback, schedules, and show time are decided elsewhere.
 */

const RESUME_GESTURE_EVENTS = ["pointerdown", "keydown"] as const;

import type { AudioTimebase } from "./playback";

/**
 * On a busy phone the context's render callbacks come late and its clock loses
 * time (2 % measured with the processor saturated), while the narration's
 * media pipeline keeps real time: every few seconds the voice is pulled back,
 * audibly. Timebases created after this call count real time instead, but
 * only while the context runs, so the show still waits for sound to start or
 * to return after an interruption. The installation never calls it.
 */
let wallClock = false;
export function preferWallClock(): void {
  wallClock = true;
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

  let runningSeconds = 0;
  let lastReadMilliseconds = performance.now();
  function readRunningSeconds(): number {
    const now = performance.now();
    if (audioContext.state === "running")
      runningSeconds += (now - lastReadMilliseconds) / 1000;
    lastReadMilliseconds = now;
    return runningSeconds;
  }

  return {
    readSeconds: wallClock
      ? readRunningSeconds
      : () => audioContext.currentTime,

    readState: () => audioContext.state,

    unload(): Promise<void> {
      for (const eventName of RESUME_GESTURE_EVENTS)
        window.removeEventListener(eventName, resume);
      unloading ??= audioContext.close();
      return unloading;
    },
  };
}
