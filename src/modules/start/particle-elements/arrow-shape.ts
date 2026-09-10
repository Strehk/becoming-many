import { Vector3 } from "three";
import type { FlightRoute } from "../flight-path/particle-contract";

// 1. Full arrow outline: shaft and one head, pointing along local +X
const OUTLINE = [
  [-0.5, -0.09],
  [0.12, -0.09],
  [0.12, -0.32],
  [0.5, 0],
  [0.12, 0.32],
  [0.12, 0.09],
  [-0.5, 0.09],
  [-0.5, -0.09],
] as const;

/** Sample the perimeter in XY; placement chooses its world-space orientation. */
export function createArrowShape(lengthMeters: number): FlightRoute {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0)
    throw new RangeError("Arrow length must be positive");
  const vertices = OUTLINE.map(
    ([x, y]) => new Vector3(x * lengthMeters, y * lengthMeters, 0),
  );
  const segments = vertices.slice(1).map((to, index) => {
    const from = vertices[index] ?? to;
    return { from, to, length: from.distanceTo(to) };
  });
  return {
    lengthMeters: segments.reduce((sum, segment) => sum + segment.length, 0),
    sample: (distance, target) => {
      for (const segment of segments) {
        if (distance <= segment.length) {
          target.lerpVectors(
            segment.from,
            segment.to,
            Math.min(1, distance / segment.length),
          );
          return;
        }
        distance -= segment.length;
      }
      target.copy(vertices[0] ?? target);
    },
  };
}
