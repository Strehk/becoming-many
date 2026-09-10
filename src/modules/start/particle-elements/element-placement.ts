import { Vector3 } from "three";
import type { ExerciseRoute } from "../start-contract";
import type { ElementPlacement, ElementSettings } from "./particle-contract";

// 1. Fixed generation limits and curvature sampling
const SETTINGS = {
  maximumPairs: 12,
  tangentSampleMeters: 2,
  curvatureEpsilon: 0.0001,
};

/** Deterministic placements in route-local space; no particle or player dependency. */
export function placeElements(
  route: ExerciseRoute,
  settings: ElementSettings,
): ElementPlacement[] {
  validateSpacing(settings);
  const placements: ElementPlacement[] = [];
  let outside = new Vector3(1, 0, 0);
  for (let index = 0; index < SETTINGS.maximumPairs; index++) {
    const distance = settings.firstMeters + index * settings.spacingMeters;
    if (distance >= route.lengthMeters) break;
    const position = new Vector3();
    const direction = new Vector3();
    route.sample(distance, position);
    route.sampleDirection(distance, direction);
    placements.push({ kind: "ring", position, direction });
    if (
      distance < route.exerciseStartMeters ||
      distance > route.exerciseEndMeters
    )
      continue;
    outside = sampleOutside(route, distance, outside);
    placements.push({
      kind: "arrow",
      position: position
        .clone()
        .addScaledVector(outside, settings.arrowOffsetMeters),
      direction,
    });
  }
  return placements;
}

function sampleOutside(
  route: ExerciseRoute,
  distance: number,
  fallback: Vector3,
): Vector3 {
  const before = new Vector3();
  const after = new Vector3();
  route.sampleDirection(
    Math.max(0, distance - SETTINGS.tangentSampleMeters),
    before,
  );
  route.sampleDirection(
    Math.min(route.lengthMeters, distance + SETTINGS.tangentSampleMeters),
    after,
  );
  const inward = after.sub(before);
  return inward.lengthSq() > SETTINGS.curvatureEpsilon
    ? inward.normalize().negate()
    : fallback;
}

function validateSpacing(settings: ElementSettings): void {
  if (
    !Number.isFinite(settings.spacingMeters) ||
    !Number.isFinite(settings.firstMeters) ||
    settings.spacingMeters <= 0 ||
    settings.firstMeters < 0
  )
    throw new RangeError("Invalid element spacing");
}
