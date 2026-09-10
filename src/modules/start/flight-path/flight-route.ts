import type { RouteParameters } from "../start-contract";
import type { FlightRoute, ParticleRange } from "./particle-contract";

// 1. Deterministic route variation
/** Generate a finite horizontal turn; visible geometry never changes after creation. */
export function createFlightRoute(
  parameters: RouteParameters,
  seed: number,
): FlightRoute {
  const radius = sampleRange(parameters.turnRadiusMeters, seed);
  const angle = sampleRange(parameters.turnRadians, seed + 1);
  return {
    lengthMeters: parameters.straightMeters + radius * angle,
    sample: (distance, target) => {
      const turn = Math.max(0, distance - parameters.straightMeters) / radius;
      target.set(
        parameters.turnSign * radius * (1 - Math.cos(turn)),
        0,
        -parameters.leadMeters -
          Math.min(distance, parameters.straightMeters) -
          radius * Math.sin(turn),
      );
    },
  };
}

// 2. Stable scalar sampling
function sampleRange(range: ParticleRange, seed: number): number {
  const fraction =
    ((Math.imul(seed, 1597334677) ^ 3812015801) >>> 0) / 4294967296;
  return range.from + (range.to - range.from) * fraction;
}
