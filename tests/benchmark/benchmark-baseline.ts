/**
 * Purpose: Record the accepted deterministic counters for gated levels.
 * Context: Draw calls and triangles repeat exactly, so they can fail a change.
 * Responsibility: Hold one accepted counter set per replay profile and level.
 * Boundary: Frame times are measurements and never appear here.
 */

import type { BenchmarkCounters } from "../../src/benchmark/benchmark-report";
import type { BenchmarkProfileName } from "../../src/benchmark/benchmark-settings";
import type { LevelName } from "../../src/levels/level-catalog";

export type BenchmarkBaseline = Readonly<
  Record<BenchmarkProfileName, Partial<Record<LevelName, BenchmarkCounters>>>
>;

/**
 * Regenerate with `bun run benchmark --profile <name> --update`. Only levels
 * listed here are checked, so a level is gated by adding it deliberately.
 */
export const BENCHMARK_BASELINE: BenchmarkBaseline = {
  full: {},
  quick: {
    "white-world": {
      maxDrawCalls: 1,
      maxTriangles: 0,
      maxGeometries: 1,
      maxTextures: 0,
      maxPrograms: 1,
    },
    scent: {
      maxDrawCalls: 13,
      maxTriangles: 1408,
      maxGeometries: 27,
      maxTextures: 0,
      maxPrograms: 3,
    },
    echo: {
      maxDrawCalls: 60,
      maxTriangles: 3810268,
      maxGeometries: 68,
      maxTextures: 1,
      maxPrograms: 8,
    },
    motion: {
      maxDrawCalls: 63,
      maxTriangles: 3810268,
      maxGeometries: 71,
      maxTextures: 1,
      maxPrograms: 10,
    },
    thermal: {
      maxDrawCalls: 89,
      maxTriangles: 3820178,
      maxGeometries: 92,
      maxTextures: 48,
      maxPrograms: 14,
    },
    magnetic: {
      maxDrawCalls: 90,
      maxTriangles: 3821138,
      maxGeometries: 93,
      maxTextures: 48,
      maxPrograms: 15,
    },
    connections: {
      maxDrawCalls: 92,
      maxTriangles: 3847938,
      maxGeometries: 93,
      maxTextures: 48,
      maxPrograms: 17,
    },
    test: {
      maxDrawCalls: 82,
      maxTriangles: 4278320,
      maxGeometries: 94,
      maxTextures: 47,
      maxPrograms: 11,
    },
    "design-test": {
      maxDrawCalls: 81,
      maxTriangles: 4277360,
      maxGeometries: 93,
      maxTextures: 47,
      maxPrograms: 10,
    },
  },
};
