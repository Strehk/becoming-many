/**
 * Purpose: Carry the playhead between the status messages that anchor it.
 * Context: Status arrives ten times a second; the readout redraws every frame.
 * Responsibility: Advance the last reported instant by the time since it arrived.
 * Boundary: The show clock remains the authority; this only fills the gaps.
 */

import type { ShowStatus } from "../station/station-protocol";

/**
 * Where the show has reached, given how long ago it last reported. A paused
 * show holds; a playing one advances at its own rate. The result is clamped to
 * the show, so it cannot run past the end while a status is in flight.
 */
export function projectShowTime(
  status: ShowStatus,
  elapsedSeconds: number,
  durationSeconds: number,
): number {
  const advancedSeconds = status.isPlaying
    ? Math.max(elapsedSeconds, 0) * status.timeScale
    : 0;

  return clamp(status.showTimeSeconds + advancedSeconds, 0, durationSeconds);
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}
