import { Vector3 } from "three";
import type { ExerciseRoute, PlacedRoute } from "../start-contract";

const UP = new Vector3(0, 1, 0);

// 1. A ring-free approach starts along travel and gently settles to level flight.
/** Local forward is -Z; negative distances extend the initial tangent behind the rig. */
export function createFlightEntry(
  lengthMeters: number,
  direction: Readonly<Vector3>,
): ExerciseRoute {
  const horizontal = Math.hypot(direction.x, direction.z);
  const slope = horizontal > 0 ? direction.y / horizontal : 0;
  return {
    lengthMeters,
    exerciseStartMeters: lengthMeters,
    exerciseEndMeters: lengthMeters,
    sample(distance, target) {
      const curvedDistance = Math.max(0, Math.min(distance, lengthMeters));
      target.set(
        0,
        slope * (distance - curvedDistance ** 2 / (2 * lengthMeters)),
        -distance,
      );
    },
    sampleDirection(distance, target) {
      target
        .set(
          0,
          slope * (1 - Math.max(0, Math.min(1, distance / lengthMeters))),
          -1,
        )
        .normalize();
    },
  };
}

// 2. Progress observes one continuous route while rendering keeps reusable slices.
/** Both inputs are fixed placements; the returned sampler uses the entry's coordinate frame. */
export function prependFlightEntry(
  entry: PlacedRoute,
  section: PlacedRoute,
): PlacedRoute {
  const offset = new Vector3()
    .subVectors(section.pose.position, entry.pose.position)
    .applyAxisAngle(UP, -entry.pose.yawRadians);
  const yaw = section.pose.yawRadians - entry.pose.yawRadians;
  const length = entry.route.lengthMeters;
  return {
    pose: entry.pose,
    route: {
      lengthMeters: length + section.route.lengthMeters,
      exerciseStartMeters: length + section.route.exerciseStartMeters,
      exerciseEndMeters: length + section.route.exerciseEndMeters,
      sample(distance, target) {
        if (distance < length) return entry.route.sample(distance, target);
        section.route.sample(distance - length, target);
        target.applyAxisAngle(UP, yaw).add(offset);
      },
      sampleDirection(distance, target) {
        if (distance < length)
          return entry.route.sampleDirection(distance, target);
        section.route.sampleDirection(distance - length, target);
        target.applyAxisAngle(UP, yaw);
      },
    },
  };
}
