/**
 * Purpose: Write show time the way an operator reads it under pressure.
 * Context: Every readout on the conductor page shows the same kind of number.
 * Responsibility: Turn seconds into minute-and-second text, and into cue lengths.
 * Boundary: Where a number comes from is decided by the caller.
 */

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

/** A cue length, where a tenth of a second is the difference that matters. */
export function formatDurationSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}

/** Headroom reads as a signed number: the sign is the whole point. */
export function formatHeadroomSeconds(seconds: number): string {
  const sign = seconds < 0 ? "−" : "+";

  return `${sign}${Math.abs(seconds).toFixed(1)} s`;
}
