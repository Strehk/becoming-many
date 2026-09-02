/**
 * Purpose: Return the flight to the pose a level starts from.
 * Context: A rehearsal or operator surface needs a way back after flying off.
 * Responsibility: Define the start pose and write it onto the flight rig.
 * Boundary: Ground clearance, input, and who asks for a reset live elsewhere.
 */

import type { Quaternion, Vector3 } from "three";

/**
 * The World Runtime creates its viewer rig unpositioned, so every level
 * begins from is the origin looking down -Z, the Three.js default forward.
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
