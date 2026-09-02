/**
 * Purpose: Keep flight navigation above the deterministic world ground.
 * Context: Flight navigation can otherwise move the viewer rig through terrain.
 * Responsibility: Clamp only the vertical position to a safe ground clearance.
 * Boundary: Input capture, surface generation, rendering, and full physics stay elsewhere.
 */

import type { Vector3 } from "three";
import type { WorldSurface } from "../world-surface/world-surface";

const MINIMUM_GROUND_CLEARANCE_METERS = 1;

/** Preserve free flight while preventing the camera from entering solid ground. */
export function keepFlightAboveGround(
  position: Vector3,
  groundYAt: WorldSurface["groundYAt"],
): void {
  const minimumY =
    groundYAt(position.x, position.z) + MINIMUM_GROUND_CLEARANCE_METERS;
  if (position.y >= minimumY) return;

  position.y = minimumY;
}
