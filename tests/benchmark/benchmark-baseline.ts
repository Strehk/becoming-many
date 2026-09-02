/**
 * Purpose: Record reviewed deterministic counters for gated levels.
 * Context: Draw calls and triangles repeat exactly, so they can fail a change.
 * Responsibility: Hold one counter guardrail per replay profile and level.
 * Boundary: This file does not approve frame time or physical PCVR performance.
 */

import type { BenchmarkCounters } from "../../src/benchmark/benchmark-report";
import type { BenchmarkProfileName } from "../../src/benchmark/benchmark-settings";
import type { LevelName } from "../../src/levels/level-catalog";

export type BenchmarkBaseline = Readonly<
  Record<BenchmarkProfileName, Partial<Record<LevelName, BenchmarkCounters>>>
>;

/**
 * Regenerate from a reviewed production-build artifact with
 * `bun run benchmark --profile <name> --update`. Only listed levels are gated.
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
      maxDrawCalls: 2,
      maxTriangles: 0,
      maxGeometries: 2,
      maxTextures: 0,
      maxPrograms: 2,
    },
    echo: {
      maxDrawCalls: 32,
      maxTriangles: 2211780,
      maxGeometries: 46,
      maxTextures: 0,
      maxPrograms: 7,
    },
    motion: {
      maxDrawCalls: 35,
      maxTriangles: 2211780,
      maxGeometries: 49,
      maxTextures: 0,
      maxPrograms: 9,
    },
    thermal: {
      maxDrawCalls: 58,
      maxTriangles: 2221690,
      maxGeometries: 69,
      maxTextures: 47,
      maxPrograms: 12,
    },
    magnetic: {
      maxDrawCalls: 59,
      maxTriangles: 2222650,
      maxGeometries: 70,
      maxTextures: 47,
      maxPrograms: 13,
    },
    connections: {
      maxDrawCalls: 61,
      maxTriangles: 2244400,
      maxGeometries: 72,
      maxTextures: 47,
      maxPrograms: 15,
    },
  },
};
