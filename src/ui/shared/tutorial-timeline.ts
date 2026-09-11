import type { Run } from "../../levels/run-contract";

export type TimelineRun = Pick<
  Run,
  | "show"
  | "readTutorial"
  | "skipTutorial"
  | "resetShowAndFlight"
  | "readPlayback"
  | "togglePlayback"
>;

/** Tutorial occupies a fixed visual block, never an invented duration. */
export const TUTORIAL_TRACK_FRACTION = 0.12;

export function showTrackFraction(
  seconds: number,
  duration: number,
  tutorial: boolean,
): number {
  const offset = tutorial ? TUTORIAL_TRACK_FRACTION : 0;
  return offset + (duration > 0 ? seconds / duration : 0) * (1 - offset);
}

export function trackShowSeconds(
  fraction: number,
  duration: number,
  tutorial: boolean,
): number | undefined {
  const offset = tutorial ? TUTORIAL_TRACK_FRACTION : 0;
  if (fraction < offset) return undefined;
  return ((fraction - offset) / (1 - offset)) * duration;
}

export function tutorialReadout(
  progress: NonNullable<ReturnType<Run["readTutorial"]>>,
): string {
  const status = {
    playing: "Running",
    paused: "Paused · Press Play",
    loading: "Loading",
    buffering: "Waiting for audio",
    blocked: "Waiting for audio · Press Play",
    error: "Error · Press Stop to retry",
    ended: "Ended",
  }[progress.playback];
  const phase =
    progress.phase === "closing"
      ? " · Closing"
      : progress.phase === "transition"
        ? " · Transition"
        : "";
  const suffix = ` · ${status}${phase}`;
  return `Tutorial ${progress.completedChunks}/${progress.totalChunks}${suffix}`;
}
