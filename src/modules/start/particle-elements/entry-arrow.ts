import { Vector3 } from "three";
import type { ExerciseRoute } from "../start-contract";
import type { ElementPlacement, ElementSettings } from "./particle-contract";

/** Place one approach arrow above the approach, aimed at the first gate rather than its tangent. */
export function placeEntryArrow(
  route: ExerciseRoute,
  placements: readonly ElementPlacement[],
  settings: NonNullable<ElementSettings["entryArrow"]>,
): ElementPlacement | undefined {
  const { distanceMeters, aboveMeters, sideMeters } = settings;
  const gate = placements.find((placement) => placement.kind === "ring");
  if (!gate) return;
  validatePlacement(settings, gate.routeDistanceMeters);
  const position = new Vector3();
  route.sample(distanceMeters, position);
  const tangent = new Vector3();
  route.sampleDirection(distanceMeters, tangent);
  position.addScaledVector(
    new Vector3(-tangent.z, 0, tangent.x).normalize(),
    sideMeters,
  );
  position.y += aboveMeters;
  const direction = new Vector3()
    .subVectors(gate.position, position)
    .normalize();
  return {
    kind: "arrow",
    position,
    direction,
    routeDistanceMeters: distanceMeters,
  };
}

function validatePlacement(
  settings: NonNullable<ElementSettings["entryArrow"]>,
  gateMeters: number,
): void {
  const { distanceMeters, aboveMeters, sideMeters } = settings;
  if (
    !Number.isFinite(aboveMeters) ||
    !Number.isFinite(sideMeters) ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    distanceMeters >= gateMeters
  )
    throw new RangeError(
      "Entry arrow must precede the first gate on the route",
    );
}
