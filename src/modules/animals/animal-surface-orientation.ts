/**
 * Purpose: Align walking animals with the local world-surface slope.
 * Context: Position sampling keeps feet on the ground but does not tilt the body.
 * Responsibility: Derive a stable surface normal and preserve the actor's heading.
 * Boundary: Movement, habitat selection, animation, and terrain rendering stay elsewhere.
 */

import { Matrix4, type Object3D, Vector3 } from "three";
import type { WorldSurface } from "../../world-surface/world-surface";

const NORMAL_SAMPLE_DISTANCE_METERS = 2;
const MIN_DIRECTION_LENGTH_SQUARED = 0.000_001;

export type AlignAnimalToSurface = (
  actor: Object3D,
  headingRadians: number,
) => void;

/** Create one allocation-free aligner shared by the small animal population. */
export function createAnimalSurfaceAlignment(
  worldSurface: WorldSurface,
): AlignAnimalToSurface {
  const surfaceNormal = new Vector3();
  const forward = new Vector3();
  const right = new Vector3();
  const rotation = new Matrix4();

  return (actor, headingRadians) => {
    sampleSurfaceNormal(
      worldSurface,
      actor.position.x,
      actor.position.z,
      surfaceNormal,
    );
    setSurfaceForward(forward, surfaceNormal, headingRadians);

    right.crossVectors(surfaceNormal, forward).normalize();
    forward.crossVectors(right, surfaceNormal).normalize();
    rotation.makeBasis(right, surfaceNormal, forward);
    actor.quaternion.setFromRotationMatrix(rotation);
  };
}

/** Central height differences yield the upward normal of the procedural surface. */
function sampleSurfaceNormal(
  worldSurface: WorldSurface,
  worldX: number,
  worldZ: number,
  target: Vector3,
): void {
  const distance = NORMAL_SAMPLE_DISTANCE_METERS;
  const heightLeft = worldSurface.surfaceYAt(worldX - distance, worldZ);
  const heightRight = worldSurface.surfaceYAt(worldX + distance, worldZ);
  const heightBehind = worldSurface.surfaceYAt(worldX, worldZ - distance);
  const heightAhead = worldSurface.surfaceYAt(worldX, worldZ + distance);

  target
    .set(heightLeft - heightRight, distance * 2, heightBehind - heightAhead)
    .normalize();
}

/** Keep forward movement tangent to the slope instead of horizontal in space. */
function setSurfaceForward(
  target: Vector3,
  surfaceNormal: Vector3,
  headingRadians: number,
): void {
  target
    .set(Math.sin(headingRadians), 0, Math.cos(headingRadians))
    .projectOnPlane(surfaceNormal);

  if (target.lengthSq() < MIN_DIRECTION_LENGTH_SQUARED) {
    target.set(0, 0, 1).projectOnPlane(surfaceNormal);
  }
  target.normalize();
}
