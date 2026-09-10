import type { Vector3 } from "three";
import type { ExerciseRoute, RouteParameters } from "../start-contract";
import type { ParticleRange } from "./particle-contract";

// 1. Seeded section dimensions
/** Straight entry, curved exercise, and tangent exit share one sampled route. */
export function createFlightRoute(
  parameters: RouteParameters,
  seed: number,
): ExerciseRoute {
  const radius = sampleRange(parameters.turnRadiusMeters, seed);
  const angle = sampleRange(parameters.turnRadians, seed + 1);
  const exerciseEnd = parameters.straightMeters + radius * angle;
  return {
    lengthMeters: exerciseEnd + parameters.outroMeters,
    exerciseStartMeters: parameters.straightMeters,
    exerciseEndMeters: exerciseEnd,
    sample: (distance, target) =>
      samplePosition({ parameters, radius, angle }, distance, target),
    sampleDirection: (distance, target) => {
      const turn = Math.min(
        angle,
        Math.max(0, distance - parameters.straightMeters) / radius,
      );
      target.set(parameters.turnSign * Math.sin(turn), 0, -Math.cos(turn));
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

// 3. Stable variation
function sampleRange(range: ParticleRange, seed: number): number {
  const fraction =
    ((Math.imul(seed, 1597334677) ^ 3812015801) >>> 0) / 4294967296;
  return range.from + (range.to - range.from) * fraction;
}
