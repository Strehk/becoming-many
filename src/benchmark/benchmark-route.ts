/**
 * Purpose: Turn an authored waypoint route into a camera pose at a route time.
 * Context: A benchmark must place the camera from the frame index alone.
 * Responsibility: Interpolate position and orientation between waypoints.
 * Boundary: Three.js objects, sampling, and settings values stay outside.
 */

import type { BenchmarkWaypoint } from "./benchmark-settings";

export interface CameraPose {
  readonly positionMeters: readonly [number, number, number];
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
}

/** Route time of the last waypoint; sampling beyond it repeats that pose. */
export function routeDurationSeconds(
  route: readonly BenchmarkWaypoint[],
): number {
  const last = route.at(-1);
  if (!last) throw new Error("Benchmark route needs at least one waypoint");
  return last.atSeconds;
}

/**
 * Linear interpolation keeps the route reproducible from the frame index and
 * readable as authored data; a smoother curve would hide which pose produced
 * a measured spike.
 */
export function cameraPoseAt(
  route: readonly BenchmarkWaypoint[],
  seconds: number,
): CameraPose {
  const first = route[0];
  if (!first) throw new Error("Benchmark route needs at least one waypoint");
  if (seconds <= first.atSeconds) return toPose(first);

  const index = route.findIndex((waypoint) => waypoint.atSeconds > seconds);
  const to = route[index];
  const from = route[index - 1];
  if (!to || !from) return toPose(route[route.length - 1] ?? first);

  const span = to.atSeconds - from.atSeconds;
  const progress = span > 0 ? (seconds - from.atSeconds) / span : 1;
  return {
    positionMeters: [
      mix(from.positionMeters[0], to.positionMeters[0], progress),
      mix(from.positionMeters[1], to.positionMeters[1], progress),
      mix(from.positionMeters[2], to.positionMeters[2], progress),
    ],
    yawDegrees: mix(from.yawDegrees, to.yawDegrees, progress),
    pitchDegrees: mix(from.pitchDegrees, to.pitchDegrees, progress),
  };
}

function toPose(waypoint: BenchmarkWaypoint): CameraPose {
  return {
    positionMeters: waypoint.positionMeters,
    yawDegrees: waypoint.yawDegrees,
    pitchDegrees: waypoint.pitchDegrees,
  };
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
