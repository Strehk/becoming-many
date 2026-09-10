import type { FlightRoute } from "../flight-path/particle-contract";

// 1. Closed ring in the local YZ plane, centered on the flight corridor
/** Sample a circle; the center remains empty and the forward axis is local +X. */
export function createRingShape(radiusMeters: number): FlightRoute {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0)
    throw new RangeError("Ring radius must be positive");
  const lengthMeters = Math.PI * 2 * radiusMeters;
  return {
    lengthMeters,
    sample: (distance, target) => {
      const angle = distance / radiusMeters;
      target.set(
        0,
        Math.cos(angle) * radiusMeters,
        Math.sin(angle) * radiusMeters,
      );
    },
  };
}
