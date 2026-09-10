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
    placements.push(samplePlacement(route, distance, "ring"));
    if (settings.showArrows === false) continue;
    const arrowDistance =
      distance + settings.spacingMeters * settings.arrowPhaseFraction;
    if (
      arrowDistance < route.exerciseStartMeters ||
      arrowDistance > route.exerciseEndMeters
    )
      continue;
    outside = sampleOutside(route, arrowDistance, outside);
    const arrow = samplePlacement(route, arrowDistance, "arrow");
    arrow.position.addScaledVector(outside, settings.arrowOffsetMeters);
    placements.push(arrow);
  }
  return placements;
}

function samplePlacement(
  route: ExerciseRoute,
  distance: number,
  kind: ElementPlacement["kind"],
): ElementPlacement {
  const position = new Vector3();
  const direction = new Vector3();
  route.sample(distance, position);
  route.sampleDirection(distance, direction);
  return { kind, position, direction, routeDistanceMeters: distance };
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
  const tangent = new Vector3();
  route.sampleDirection(distance, tangent);
  inward.addScaledVector(tangent, -inward.dot(tangent));
  return inward.lengthSq() > SETTINGS.curvatureEpsilon
    ? inward.normalize().negate()
    : fallback;
}

function validateSpacing(settings: ElementSettings): void {
  if (
    !Number.isFinite(settings.spacingMeters) ||
    !Number.isFinite(settings.firstMeters) ||
    settings.spacingMeters <= 0 ||
    settings.firstMeters < 0 ||
    !Number.isFinite(settings.arrowPhaseFraction) ||
    settings.arrowPhaseFraction < 0 ||
    settings.arrowPhaseFraction >= 1
  )
    throw new RangeError("Invalid element spacing");
}
