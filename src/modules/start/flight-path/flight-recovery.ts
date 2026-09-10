import { Vector3 } from "three";
import type { Viewpoint } from "../../../world/viewpoint";
import type { ExercisePose } from "../start-contract";

// Entry placement only: capture actual flight once; looking around never moves the route.
const FORWARD = new Vector3(0, 0, -1);

/** Offset from the rig along actual travel and preserve its horizontal heading. */
export function placeFlightRecovery(
  viewpoint: Viewpoint,
  leadMeters: number,
  constrain: (position: Vector3) => void,
): ExercisePose {
  const travel = viewpoint.worldFlightDirection ?? FORWARD;
  const direction = new Vector3().copy(travel);
  if (direction.lengthSq() === 0) direction.copy(FORWARD);
  const position = new Vector3().copy(
    viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
  );
  position.addScaledVector(direction.normalize(), leadMeters);
  constrain(position);
  const heading = Math.hypot(travel.x, travel.z) > 0 ? travel : FORWARD;
  return { position, yawRadians: Math.atan2(-heading.x, -heading.z) };
}
