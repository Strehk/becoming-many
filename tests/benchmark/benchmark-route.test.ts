/**
 * Purpose: Verify that a route time maps to one reproducible camera pose.
 * Context: A benchmark places the camera from the frame index alone.
 * Responsibility: Cover clamping, interpolation, and duration.
 * Boundary: Three.js objects and frame sampling stay outside this test.
 */

import { describe, expect, test } from "bun:test";
import {
  cameraPoseAt,
  routeDurationSeconds,
} from "../../src/benchmark/benchmark-route";
import {
  BENCHMARK_SETTINGS,
  type BenchmarkWaypoint,
} from "../../src/benchmark/benchmark-settings";

const route: readonly BenchmarkWaypoint[] = [
  { atSeconds: 0, positionMeters: [0, 0, 0], yawDegrees: 0, pitchDegrees: 0 },
  {
    atSeconds: 2,
    positionMeters: [10, 4, -20],
    yawDegrees: 90,
    pitchDegrees: -30,
  },
];

describe("benchmark route", () => {
  test("holds the first waypoint before the route starts", () => {
    expect(cameraPoseAt(route, -5)).toEqual(cameraPoseAt(route, 0));
  });

  test("holds the last waypoint after the route ends", () => {
    expect(cameraPoseAt(route, 99)).toEqual(cameraPoseAt(route, 2));
  });

  test("interpolates position and orientation between waypoints", () => {
    const pose = cameraPoseAt(route, 1);

    expect(pose.positionMeters).toEqual([5, 2, -10]);
    expect(pose.yawDegrees).toBe(45);
    expect(pose.pitchDegrees).toBe(-15);
  });

  test("returns the same pose for the same route time", () => {
    expect(cameraPoseAt(route, 1.37)).toEqual(cameraPoseAt(route, 1.37));
  });

  test("reports the route duration from its last waypoint", () => {
    expect(routeDurationSeconds(route)).toBe(2);
  });

  test("rejects an empty route instead of measuring nothing", () => {
    expect(() => cameraPoseAt([], 0)).toThrow();
    expect(() => routeDurationSeconds([])).toThrow();
  });

  test("keeps the authored route ordered and non-empty", () => {
    const times = BENCHMARK_SETTINGS.route.map(({ atSeconds }) => atSeconds);

    expect(times.length).toBeGreaterThan(1);
    expect([...times].sort((first, second) => first - second)).toEqual(times);
  });
});
