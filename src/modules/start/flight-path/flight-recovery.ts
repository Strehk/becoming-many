import { Vector3 } from "three";
import type { Viewpoint } from "../../../world/viewpoint";
import type { ExercisePose } from "../start-contract";

// Recovery placement only: capture the latest view when the new route becomes visible.
const FORWARD = new Vector3(0, 0, -1);

/** Keep the entry in view; preserve horizontal travel heading for the exercise. */
export function placeFlightRecovery(
  viewpoint: Viewpoint,
  leadMeters: number,
  constrain: (position: Vector3) => void,
): ExercisePose {
  const travel = viewpoint.worldFlightDirection ?? FORWARD;
  const gaze = new Vector3().copy(viewpoint.worldDirection);
  if (gaze.lengthSq() === 0) gaze.copy(travel);
  const position = new Vector3().copy(
    viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
  );
  position.addScaledVector(gaze.normalize(), leadMeters);
  constrain(position);
  const heading = Math.hypot(travel.x, travel.z) > 0 ? travel : FORWARD;
  return { position, yawRadians: Math.atan2(-heading.x, -heading.z) };
}
