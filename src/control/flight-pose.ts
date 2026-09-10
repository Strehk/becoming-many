import type { Quaternion, Vector3 } from "three";
import type { WorldSurface } from "../world-surface/world-surface";

export interface FlightHeightLimits {
  readonly minimumGroundClearanceMeters: number | undefined;
  readonly maximumGroundClearanceMeters: number | undefined;
}

/** Preserve horizontal flight while constraining altitude over local terrain. */
export function keepFlightWithinHeightLimits(
  position: Vector3,
  groundYAt: WorldSurface["groundYAt"],
  limits: FlightHeightLimits,
): void {
  const groundY = groundYAt(position.x, position.z);
  const minimumY =
    limits.minimumGroundClearanceMeters === undefined
      ? Number.NEGATIVE_INFINITY
      : groundY + limits.minimumGroundClearanceMeters;
  const maximumY =
    limits.maximumGroundClearanceMeters === undefined
      ? Number.POSITIVE_INFINITY
      : groundY + limits.maximumGroundClearanceMeters;

  position.y = Math.min(Math.max(position.y, minimumY), maximumY);
}

/** Reset rig position and heading; Run applies terrain clearance separately. */
export function resetFlightPose(
  position: Vector3,
  quaternion: Quaternion,
): void {
  position.set(0, 0, 0);
  quaternion.identity();
}
