/**
 * Purpose: Write show readouts the way an operator reads them under pressure.
 * Context: Rehearsal and Conductor shows the same kind of text.
 * Responsibility: Turn seconds into minute-and-second text, and cue ids into
 *   chapter names.
 * Boundary: Where a number comes from is decided by the caller.
 */

import type { RunningShow } from "../../levels/show.runtime";

const SECONDS_PER_MINUTE = 60;

/**
 * Minutes and seconds, always two digits of seconds. A negative input reads as
 * zero rather than growing a minus sign the operator has to parse mid-show.
 */
export function formatShowTime(seconds: number): string {
  const whole = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const remainder = whole % SECONDS_PER_MINUTE;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

/** A cue id reads as a chapter name: "prologue" is the chapter "Prologue". */
export function cueDisplayName(cueId: string): string {
  return cueId.charAt(0).toUpperCase() + cueId.slice(1);
}

/** The approved four-direction tutorial is displayed separately from show time. */
export function formatTutorialStatus(
  tutorial: NonNullable<ReturnType<RunningShow["readTutorial"]>>,
): string {
  if (tutorial.phase === "loading") return "Flight tutorial · Preparing audio";
  if (tutorial.phase === "failed")
    return "Flight tutorial · Preparation failed · Reset to retry";
  const completed = tutorial.phase === "complete";
  const direction = completed ? "Complete" : cueDisplayName(tutorial.direction);
  return `Flight tutorial · ${direction} · ${completed ? 4 : tutorial.goalIndex + 1}/4`;
}
