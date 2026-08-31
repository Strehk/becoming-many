/**
 * Purpose: Verify how recorded frames become one comparable benchmark report.
 * Context: Counters gate changes, so their summary must not drift.
 * Responsibility: Cover counter maxima, percentiles, missed runs, and streaming.
 * Boundary: Browser rendering and route evaluation stay outside this test.
 */

import { describe, expect, test } from "bun:test";
import {
  type BenchmarkFrameSample,
  summarizeBenchmark,
} from "../../src/benchmark/benchmark-report";

const BUDGET_MILLISECONDS = 11.11;

describe("summarizeBenchmark", () => {
  test("reports the highest counter value seen in any frame", () => {
    const report = summarize([
      frame({ drawCalls: 61, triangles: 1_000, programs: 9 }),
      frame({ drawCalls: 44, triangles: 5_900_000, programs: 11 }),
    ]);

    expect(report.counters.maxDrawCalls).toBe(61);
    expect(report.counters.maxTriangles).toBe(5_900_000);
    expect(report.counters.maxPrograms).toBe(11);
  });

  test("orders frame times before reading percentiles", () => {
    const report = summarize(
      [20, 8, 10, 9, 30].map((frameMilliseconds) =>
        frame({ frameMilliseconds }),
      ),
    );

    expect(report.timing.medianMilliseconds).toBe(10);
    expect(report.timing.maxMilliseconds).toBe(30);
    expect(report.timing.p99Milliseconds).toBe(30);
  });

  test("counts frames above the budget and their longest run", () => {
    const report = summarize(
      [8, 20, 20, 8, 20].map((frameMilliseconds) =>
        frame({ frameMilliseconds }),
      ),
    );

    expect(report.timing.missedFrames).toBe(3);
    expect(report.timing.longestMissedRunFrames).toBe(2);
  });

  test("reports the frame at which streaming stopped", () => {
    const report = summarize([
      frame({ streamQueueSize: 12 }),
      frame({ streamQueueSize: 3 }),
      frame({ streamQueueSize: 0 }),
    ]);

    expect(report.streaming.maxQueueSize).toBe(12);
    expect(report.streaming.framesUntilDrained).toBe(2);
  });

  test("marks a queue that never drained instead of reporting a frame", () => {
    const report = summarize([frame({ streamQueueSize: 1 })]);

    expect(report.streaming.framesUntilDrained).toBe(-1);
  });

  test("summarizes an empty run without throwing", () => {
    const report = summarize([]);

    expect(report.frames).toBe(0);
    expect(report.counters.maxDrawCalls).toBe(0);
    expect(report.timing.medianMilliseconds).toBe(0);
  });
});

function summarize(samples: readonly BenchmarkFrameSample[]) {
  return summarizeBenchmark("test", "full", samples, BUDGET_MILLISECONDS);
}

function frame(overrides: Partial<BenchmarkFrameSample>): BenchmarkFrameSample {
  return {
    frameMilliseconds: 10,
    drawCalls: 1,
    triangles: 1,
    geometries: 1,
    textures: 1,
    programs: 1,
    streamQueueSize: 0,
    ...overrides,
  };
}
