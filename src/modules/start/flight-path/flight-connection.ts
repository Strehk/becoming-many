import { Vector3 } from "three";
import type {
  ExercisePose,
  ExerciseRoute,
  PlacedRoute,
} from "../start-contract";

// Connection geometry only: no progression, rendering, or player tracking.
const UP = new Vector3(0, 1, 0);

/** Align the successor entry and tangent, including any authored local entry offset. */
export function connectFlightRoute(
  previous: PlacedRoute,
  next: ExerciseRoute,
): ExercisePose {
  const position = new Vector3();
  const direction = new Vector3();
  previous.route.sample(previous.route.lengthMeters, position);
  previous.route.sampleDirection(previous.route.lengthMeters, direction);
  position
    .applyAxisAngle(UP, previous.pose.yawRadians)
    .add(previous.pose.position);
  direction.applyAxisAngle(UP, previous.pose.yawRadians);
  const yawRadians = Math.atan2(-direction.x, -direction.z);
  const entry = new Vector3();
  next.sample(0, entry);
  position.sub(entry.applyAxisAngle(UP, yawRadians));
  return { position, yawRadians };
}
