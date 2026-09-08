import type { Quaternion, Vector3 } from "three";

/**
 * The World Runtime creates its viewer rig unpositioned, so every level
 * begins at the origin looking down -Z, the Three.js default forward.
 * Ground clearance lifts it clear of the surface on the following frame; this
 * file must not duplicate that clamp.
 */
export function resetFlightPose(
  position: Vector3,
  quaternion: Quaternion,
): void {
  position.set(0, 0, 0);
  quaternion.identity();
}
