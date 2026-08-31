/**
 * Purpose: Define the fixed conditions that every benchmark run replays.
 * Context: Comparable numbers require an identical workload on every machine.
 * Responsibility: Hold the camera route, warmup, replay profiles, and frame budget.
 * Boundary: Route evaluation, sampling, and reporting live in sibling files.
 */

/** One authored camera pose on the replayed route. */
export interface BenchmarkWaypoint {
  /** Route time of this pose; the route ends at the last waypoint. */
  readonly atSeconds: number;
  readonly positionMeters: readonly [number, number, number];
  /** Rotation around Y. Zero looks toward -Z, the Three.js default forward. */
  readonly yawDegrees: number;
  /** Rotation around X. Negative looks down at the ground. */
  readonly pitchDegrees: number;
}

export const BENCHMARK_SETTINGS = {
  // Frames rendered before sampling starts, held at the first waypoint. The
  // stream queue spends a fixed budget per frame, so a frame count — not a
  // duration — decides how much content is resident when measurement begins.
  warmupFrames: 240,

  // Stream-queue steps allowed per frame, replacing the wall-clock budget in
  // WORLD_RUNTIME_SETTINGS. A benchmark therefore measures a fixed streaming
  // rate, not the production time-budgeted one.
  //
  // Measured on the Connections level: 8 steps left the queue pinned at its
  // 256-job capacity, where enqueue() rejects work and the counters describe
  // dropped work instead of the scene. 64 steps peaked at 199 with headroom.
  // Raising it also adds per-frame CPU work and inflates measured frame time,
  // so it must stay constant between compared runs, and it should be
  // recalibrated against a real GPU session before frame times are quoted.
  streamStepsPerFrame: 64,

  // The 90 Hz acceptance target from docs/performance.md. Sampled frames above
  // it count as missed frames in the report.
  frameBudgetMilliseconds: 11.11,

  // Replay density. Every profile flies the same route; a larger timestep
  // covers it in fewer frames. Counters differ per profile, so each profile
  // keeps its own baseline.
  profiles: {
    // Full 90 Hz replay. The profile to quote frame-time percentiles from.
    full: { fixedDeltaSeconds: 1 / 90 },
    // Coarse replay for a fast counter check while iterating. Counters stay
    // exact; its frame times are too sparse to describe the 90 Hz target.
    quick: { fixedDeltaSeconds: 1 / 15 },
  },

  // A fixed flight that streams chunks in and out: straight run, diagonal
  // turn, climb with a downward look, then a sweep back across new ground.
  // Y values are minimums where a level clamps flight above its surface.
  route: [
    {
      atSeconds: 0,
      positionMeters: [0, 12, 0],
      yawDegrees: 0,
      pitchDegrees: -10,
    },
    {
      atSeconds: 4,
      positionMeters: [0, 12, -80],
      yawDegrees: 0,
      pitchDegrees: -10,
    },
    {
      atSeconds: 7,
      positionMeters: [60, 12, -140],
      yawDegrees: -45,
      pitchDegrees: -5,
    },
    {
      atSeconds: 10,
      positionMeters: [60, 30, -220],
      yawDegrees: -90,
      pitchDegrees: -20,
    },
    {
      atSeconds: 14,
      positionMeters: [-40, 18, -300],
      yawDegrees: 30,
      pitchDegrees: 0,
    },
  ] as readonly BenchmarkWaypoint[],
} as const;

export type BenchmarkProfileName = keyof typeof BENCHMARK_SETTINGS.profiles;

export const BENCHMARK_PROFILE_NAMES = Object.keys(
  BENCHMARK_SETTINGS.profiles,
) as readonly BenchmarkProfileName[];

export function isBenchmarkProfileName(
  value: string,
): value is BenchmarkProfileName {
  return value in BENCHMARK_SETTINGS.profiles;
}
