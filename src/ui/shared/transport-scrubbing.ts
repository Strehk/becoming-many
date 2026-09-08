import type { RunningShow } from "../../levels/show.runtime";

interface ScrubbingOptions {
  readonly track: SVGSVGElement;
  readonly durationSeconds: number;
  readonly show: Pick<RunningShow, "sample" | "play" | "pause" | "seekTo">;
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
  readonly signal: AbortSignal;
  /** UI availability, evaluated at gesture start; absent means enabled. */
  readonly isEnabled?: () => boolean;
}

const SCRUB_INTERVAL_MILLISECONDS = 1_000 / 20;

/**
 * Preview every pointer move while bounding seeks to 20 Hz. Release commits
 * the final position and restores playback; cancellation uses the last observed
 * position. Unmount releases capture without restarting an ending show.
 */
export function attachScrubbing({
  track,
  durationSeconds,
  show,
  onScrubChange,
  signal,
  isEnabled,
}: ScrubbingOptions): void {
  if (signal.aborted) return;
  let pointerId: number | undefined;
  let wasPlaying = false;
  let scrubSeconds = 0;
  let lastSentMilliseconds = 0;

  function readShowTime(event: PointerEvent): number {
    const bounds = track.getBoundingClientRect();
    if (bounds.width <= 0) return scrubSeconds;
    const fraction = (event.clientX - bounds.left) / bounds.width;
    return Math.min(Math.max(fraction, 0), 1) * durationSeconds;
  }

  function finish(resume: boolean): void {
    if (pointerId === undefined) return;
    const capturedPointer = pointerId;
    pointerId = undefined;
    if (track.hasPointerCapture(capturedPointer))
      track.releasePointerCapture(capturedPointer);
    if (resume) {
      show.seekTo(scrubSeconds);
      if (wasPlaying) show.play();
    }
    wasPlaying = false;
    onScrubChange(undefined);
  }

  track.addEventListener(
    "pointerdown",
    (event) => {
      if (
        pointerId !== undefined ||
        event.button !== 0 ||
        isEnabled?.() === false
      )
        return;
      track.setPointerCapture(event.pointerId);
      pointerId = event.pointerId;
      wasPlaying = show.sample().isPlaying;
      if (wasPlaying) show.pause();
      scrubSeconds = readShowTime(event);
      lastSentMilliseconds = performance.now();
      onScrubChange(scrubSeconds);
      show.seekTo(scrubSeconds);
    },
    { signal },
  );

  track.addEventListener(
    "pointermove",
    (event) => {
      if (pointerId !== event.pointerId) return;
      scrubSeconds = readShowTime(event);
      onScrubChange(scrubSeconds);
      const now = performance.now();
      if (now - lastSentMilliseconds < SCRUB_INTERVAL_MILLISECONDS) return;
      lastSentMilliseconds = now;
      show.seekTo(scrubSeconds);
    },
    { signal },
  );

  track.addEventListener(
    "pointerup",
    (event) => {
      if (pointerId !== event.pointerId) return;
      scrubSeconds = readShowTime(event);
      finish(true);
    },
    { signal },
  );

  const cancel = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) finish(true);
  };
  track.addEventListener("pointercancel", cancel, { signal });
  track.addEventListener("lostpointercapture", cancel, { signal });
  signal.addEventListener("abort", () => finish(false), { once: true });
}
