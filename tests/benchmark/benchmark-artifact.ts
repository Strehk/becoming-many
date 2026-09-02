/**
 * Purpose: Render finished benchmark reports as one readable Markdown artifact.
 * Context: A measurement is only evidence when its conditions are written down.
 * Responsibility: Separate deterministic counters from machine-local timing.
 * Boundary: Running the browser and comparing baselines stay in the runner.
 */

import type { BenchmarkReport } from "../../src/benchmark/benchmark-report";
import { BENCHMARK_SETTINGS } from "../../src/benchmark/benchmark-settings";

/** Everything about a run that changes its numbers and is not in the report. */
export interface BenchmarkConditions {
  readonly profileName: string;
  readonly generatedAt: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly rendering: string;
  readonly browserVersion: string;
}

/** A level that produced no report; listed so a partial run cannot read as complete. */
export interface LevelFailure {
  readonly levelName: string;
  readonly reason: string;
}

export function renderBenchmarkArtifact(
  conditions: BenchmarkConditions,
  reports: readonly BenchmarkReport[],
  failures: readonly LevelFailure[] = [],
): string {
  return [
    "# Benchmark Report",
    "",
    renderConditions(conditions),
    "",
    ...renderFailures(failures),
    "## Counters",
    "",
    "Exact integers from `renderer.info`. A deterministic route repeats these",
    "on any machine, so a change here is a real change in the scene.",
    "",
    renderCounters(reports),
    "",
    "## Frame Time",
    "",
    "Measurements, not facts. Comparable only against another run on the same",
    "machine and rendering path. A missed frame exceeds the",
    `${BENCHMARK_SETTINGS.frameBudgetMilliseconds} ms budget of the 90 Hz acceptance target.`,
    "",
    renderTiming(reports),
    "",
    "## Streaming",
    "",
    "Queue depth is measured in frames, never in seconds, so it stays",
    "reproducible.",
    "",
    renderStreaming(reports),
    "",
    "## Reading This",
    "",
    "- Desktop numbers detect regressions; only the complete physical PCVR",
    "  path accepts a performance claim (see `docs/performance.md`).",
    "- A benchmark replaces the wall clock with a fixed timestep and the",
    "  stream-queue time budget with a fixed step count. It therefore measures",
    "  a fixed streaming rate, not the production time-budgeted one.",
    "- Frame times under software rendering describe the rasterizer, not a",
    "  headset. Run with `--headed` on a GPU before quoting them.",
    "",
  ].join("\n");
}

function renderFailures(failures: readonly LevelFailure[]): readonly string[] {
  if (failures.length === 0) return [];

  return [
    "## Not Measured",
    "",
    "These levels produced no report, so this artifact is partial.",
    "",
    table(
      ["Level", "Reason"],
      failures.map(({ levelName, reason }) => [levelName, reason]),
    ),
    "",
  ];
}

function renderConditions(conditions: BenchmarkConditions): string {
  const { fixedDeltaSeconds } = readProfile(conditions.profileName);
  const replayHz = Math.round(1 / fixedDeltaSeconds);

  return [
    `- Generated: ${conditions.generatedAt}`,
    `- Profile: \`${conditions.profileName}\` (${replayHz} Hz replay)`,
    `- Viewport: ${conditions.viewport.width}x${conditions.viewport.height} at device scale 1`,
    `- Rendering: ${conditions.rendering}`,
    `- Browser: Chromium ${conditions.browserVersion}`,
    `- Warmup: ${BENCHMARK_SETTINGS.warmupFrames} discarded frames`,
    `- Stream steps per frame: ${BENCHMARK_SETTINGS.streamStepsPerFrame}`,
  ].join("\n");
}

function renderCounters(reports: readonly BenchmarkReport[]): string {
  return table(
    ["Level", "Draw calls", "Triangles", "Geometries", "Textures", "Programs"],
    reports.map((report) => [
      report.levelName,
      count(report.counters.maxDrawCalls),
      count(report.counters.maxTriangles),
      count(report.counters.maxGeometries),
      count(report.counters.maxTextures),
      count(report.counters.maxPrograms),
    ]),
  );
}

function renderTiming(reports: readonly BenchmarkReport[]): string {
  return table(
    ["Level", "Frames", "Median", "p95", "p99", "Max", "Missed", "Longest run"],
    reports.map((report) => [
      report.levelName,
      count(report.frames),
      milliseconds(report.timing.medianMilliseconds),
      milliseconds(report.timing.p95Milliseconds),
      milliseconds(report.timing.p99Milliseconds),
      milliseconds(report.timing.maxMilliseconds),
      `${count(report.timing.missedFrames)} (${share(report.timing.missedFrames, report.frames)})`,
      `${count(report.timing.longestMissedRunFrames)} frames`,
    ]),
  );
}

function renderStreaming(reports: readonly BenchmarkReport[]): string {
  return table(
    ["Level", "Peak queue", "Frames until drained"],
    reports.map((report) => [
      report.levelName,
      count(report.streaming.maxQueueSize),
      report.streaming.framesUntilDrained < 0
        ? "never drained"
        : count(report.streaming.framesUntilDrained),
    ]),
  );
}

function readProfile(profileName: string): {
  readonly fixedDeltaSeconds: number;
} {
  const profiles: Record<string, { readonly fixedDeltaSeconds: number }> =
    BENCHMARK_SETTINGS.profiles;
  return profiles[profileName] ?? { fixedDeltaSeconds: 1 };
}

function table(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function milliseconds(value: number): string {
  return `${value.toFixed(2)} ms`;
}

function share(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}
