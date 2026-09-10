import type { Vector3 } from "three";
import type { ExerciseRoute, RouteParameters } from "../start-contract";
import type { ParticleRange } from "./particle-contract";

// 1. Seeded section dimensions
/** Straight entry, curved exercise, and tangent exit share one sampled route. */
export function createFlightRoute(
  parameters: RouteParameters,
  seed: number,
): ExerciseRoute {
  validateRoute(parameters);
  const radius = sampleRange(parameters.turnRadiusMeters, seed);
  const angle = (sampleRange(parameters.turnDegrees, seed + 1) * Math.PI) / 180;
  const arcAngle = angle * (parameters.turnPlane === "vertical" ? 2 : 1);
  const exerciseEnd = parameters.straightMeters + radius * arcAngle;
  return {
    lengthMeters: exerciseEnd + parameters.outroMeters,
    exerciseStartMeters: parameters.straightMeters,
    exerciseEndMeters: exerciseEnd,
    sample: (distance, target) =>
      samplePosition({ parameters, radius, angle }, distance, target),
    sampleDirection: (distance, target) => {
      const turn = Math.min(
        arcAngle,
        Math.max(0, distance - parameters.straightMeters) / radius,
      );
      const vertical = parameters.turnPlane === "vertical";
      const bend = vertical ? Math.min(turn, arcAngle - turn) : turn;
      target.set(
        vertical ? 0 : parameters.turnSign * Math.sin(bend),
        vertical ? parameters.turnSign * Math.sin(bend) : 0,
        -Math.cos(bend),
      );
    },
  };
}

// 2. Continuous centerline and exit tangent
function samplePosition(
  section: { parameters: RouteParameters; radius: number; angle: number },
  distance: number,
  target: Vector3,
): void {
  const { parameters, radius, angle } = section;
  if (parameters.turnPlane === "vertical") {
    sampleVerticalPosition(section, distance, target);
    return;
  }
  const turn = Math.min(
    angle,
    Math.max(0, distance - parameters.straightMeters) / radius,
  );
  const exit = Math.max(
    0,
    distance - parameters.straightMeters - radius * angle,
  );
  target.set(
    parameters.turnSign *
      (radius * (1 - Math.cos(turn)) + exit * Math.sin(angle)),
    0,
    -parameters.leadMeters -
      Math.min(distance, parameters.straightMeters) -
      radius * Math.sin(turn) -
      exit * Math.cos(angle),
  );
}

// A pair of opposite arcs changes altitude without leaving a pitched chunk seam.
function sampleVerticalPosition(
  section: { parameters: RouteParameters; radius: number; angle: number },
  distance: number,
  target: Vector3,
): void {
  const { parameters, radius, angle } = section;
  const turn = Math.min(
    2 * angle,
    Math.max(0, distance - parameters.straightMeters) / radius,
  );
  const returning = turn > angle;
  const bend = returning ? 2 * angle - turn : turn;
  const height =
    radius *
    (returning ? 1 - 2 * Math.cos(angle) + Math.cos(bend) : 1 - Math.cos(bend));
  const forward =
    radius *
    (returning ? 2 * Math.sin(angle) - Math.sin(bend) : Math.sin(bend));
  const exit = Math.max(
    0,
    distance - parameters.straightMeters - 2 * radius * angle,
  );
  target.set(
    0,
    parameters.turnSign * height,
    -parameters.leadMeters -
      Math.min(distance, parameters.straightMeters) -
      forward -
      exit,
  );
}

// 3. Stable variation
function sampleRange(range: ParticleRange, seed: number): number {
  const fraction =
    ((Math.imul(seed, 1597334677) ^ 3812015801) >>> 0) / 4294967296;
  return range.from + (range.to - range.from) * fraction;
}

// 4. Reject invalid authoring before geometry allocation.
function validateRoute(parameters: RouteParameters): void {
  const lengths = [
    parameters.leadMeters,
    parameters.straightMeters,
    parameters.outroMeters,
  ];
  if (lengths.some((length) => !Number.isFinite(length) || length < 0))
    throw new RangeError(
      "Route entry and exit lengths must be finite and nonnegative",
    );
  validateRange(parameters.turnRadiusMeters, Number.MIN_VALUE, Infinity);
  validateRange(
    parameters.turnDegrees,
    0,
    parameters.turnPlane === "vertical" ? 45 : 360,
  );
  if (parameters.turnSign !== -1 && parameters.turnSign !== 1)
    throw new RangeError("Turn direction must be -1 (left) or 1 (right)");
}
function validateRange(
  range: ParticleRange,
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to) ||
    range.from < minimum ||
    range.to > maximum ||
    range.to < range.from
  )
    throw new RangeError("Invalid route parameter range");
}
