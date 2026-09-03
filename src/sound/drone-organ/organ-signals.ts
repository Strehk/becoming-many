/**
 * Purpose: Turn where the visitor is and where they look into the 0..1 signals
 *   the organ's patched controls read.
 * Context: The old instrument offered a whole flight console of these. This
 *   composition patches two of them, so two is what the port carries.
 * Responsibility: Own the pose contract and the mapping into control range.
 * Boundary: Which control a signal reaches is authored in the composition;
 *   where the pose comes from is the level runtime's concern.
 */

/** The visitor, as the organ needs them: a point and a heading. */
export interface ListenerPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  /** Zero looks north, growing eastward; the same heading the panner uses. */
  readonly yawRadians: number;
  readonly pitchRadians: number;
}

/** A patchable world signal. Add one here and the composition can reach it. */
export type OrganSignalName = "altitude" | "north";

/** Height above ground that reads as fully high; above it the signal saturates. */
const ALTITUDE_RANGE_METERS = 60;

export function readOrganSignal(
  name: OrganSignalName,
  pose: ListenerPose,
  groundYMeters: number,
): number {
  switch (name) {
    case "altitude":
      return clamp01((pose.y - groundYMeters) / ALTITUDE_RANGE_METERS);

    // A compass course would run 0..1 once around the circle and jump back at
    // north — a cliff in the control exactly where the visitor is facing. This
    // is the seamless reading of the same heading: one facing north, zero
    // facing south, and half at either side.
    case "north":
      return 0.5 + Math.cos(pose.yawRadians) * 0.5;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
