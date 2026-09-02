/**
 * Purpose: Keep flight navigation within terrain-relative height limits.
 * Context: Flight can otherwise enter terrain or climb beyond the intended space.
 * Responsibility: Clamp only the vertical position between configured clearances.
 * Boundary: Input capture, surface generation, rendering, and full physics stay elsewhere.
 */

import type { Vector3 } from "three";
import type { WorldSurface } from "../world-surface/world-surface";
import { FLIGHT_SETTINGS } from "./flight-settings";

export interface FlightHeightLimits {
  readonly minimumGroundClearanceMeters: number | undefined;
  readonly maximumGroundClearanceMeters: number | undefined;
}

/** Preserve horizontal flight while constraining altitude over local terrain. */
export function keepFlightWithinHeightLimits(
  position: Vector3,
  groundYAt: WorldSurface["groundYAt"],
  limits: FlightHeightLimits,
): void {
  const groundY = groundYAt(position.x, position.z);
  const minimumY =
    limits.minimumGroundClearanceMeters === undefined
      ? Number.NEGATIVE_INFINITY
      : groundY + limits.minimumGroundClearanceMeters;
  const maximumY =
    limits.maximumGroundClearanceMeters === undefined
      ? Number.POSITIVE_INFINITY
      : groundY + limits.maximumGroundClearanceMeters;

  position.y = Math.min(Math.max(position.y, minimumY), maximumY);
}

/** The base lower bound used by levels that expose a world surface. */
export const BASE_MINIMUM_GROUND_CLEARANCE_METERS =
  FLIGHT_SETTINGS.minimumGroundClearanceMeters;
