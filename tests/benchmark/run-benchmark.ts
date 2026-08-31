/**
 * Purpose: Provide the `bun run benchmark` command.
 * Context: The measurement lives in the application; this file is its harness.
 * Responsibility: Read the requested run, orchestrate it, and write the artifact.
 * Boundary: Browser driving, baselines, and serving live in sibling files.
 */

import { mkdir, writeFile } from "node:fs/promises";
import type { BenchmarkReport } from "../../src/benchmark/benchmark-report";
import {
  BENCHMARK_PROFILE_NAMES,
  type BenchmarkProfileName,
  isBenchmarkProfileName,
} from "../../src/benchmark/benchmark-settings";
import {
  isLevelName,
  LEVEL_NAMES,
  type LevelName,
} from "../../src/levels/level-catalog";
import {
  type BenchmarkConditions,
  type LevelFailure,
  renderBenchmarkArtifact,
} from "./benchmark-artifact";
import { checkBaseline, updateBaseline } from "./benchmark-baseline-check";
import { runLevelsInBrowser } from "./benchmark-browser";
import { PREVIEW_PORT, startPreviewServer } from "./benchmark-preview-server";

const DEFAULT_RESULTS_DIRECTORY = "benchmark-results";
const DEFAULT_LEVEL_TIMEOUT_SECONDS = 600;

interface RunOptions {
  readonly profileName: BenchmarkProfileName;
  readonly levelNames: readonly LevelName[];
  readonly baseUrl: string | undefined;
  readonly outputDirectory: string;
  readonly levelTimeoutMilliseconds: number;
  readonly isHeaded: boolean;
  readonly shouldCheck: boolean;
  readonly shouldUpdate: boolean;
}

await main();

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const stopServer = options.baseUrl ? undefined : await startPreviewServer();

  try {
    const { reports, failures, conditions } = await runLevelsInBrowser({
      profileName: options.profileName,
      levelNames: options.levelNames,
      baseUrl: options.baseUrl ?? `http://127.0.0.1:${PREVIEW_PORT}`,
      isHeaded: options.isHeaded,
      levelTimeoutMilliseconds: options.levelTimeoutMilliseconds,
    });

    printReports(reports);
    await writeArtifacts(options, conditions, reports, failures);

    if (options.shouldUpdate) {
      await updateBaseline(options.profileName, reports);
    }
    if (reportFailures(failures)) process.exitCode = 1;
    if (options.shouldCheck && !checkBaseline(options.profileName, reports)) {
      process.exitCode = 1;
    }
  } finally {
    stopServer?.();
  }
}

function readOptions(argv: readonly string[]): RunOptions {
  const requestedProfile = readValue(argv, "--profile") ?? "full";
  if (!isBenchmarkProfileName(requestedProfile)) {
    throw new Error(
      `Unknown profile "${requestedProfile}". Use one of: ${BENCHMARK_PROFILE_NAMES.join(", ")}`,
    );
  }

  return {
    profileName: requestedProfile,
    levelNames: readLevelNames(argv),
    baseUrl: readValue(argv, "--base-url"),
    outputDirectory: readValue(argv, "--out") ?? DEFAULT_RESULTS_DIRECTORY,
    levelTimeoutMilliseconds:
      Number(readValue(argv, "--timeout") ?? DEFAULT_LEVEL_TIMEOUT_SECONDS) *
      1000,
    isHeaded: argv.includes("--headed"),
    shouldCheck: argv.includes("--check"),
    shouldUpdate: argv.includes("--update"),
  };
}

/** Repeatable `--level`; every level runs when none is named. */
function readLevelNames(argv: readonly string[]): readonly LevelName[] {
  const requested = argv.flatMap((entry, index) =>
    entry === "--level" ? [argv[index + 1] ?? ""] : [],
  );
  for (const name of requested) {
    if (!isLevelName(name)) {
      throw new Error(
        `Unknown level "${name}". Use one of: ${LEVEL_NAMES.join(", ")}`,
      );
    }
  }
  return requested.length > 0 ? (requested as LevelName[]) : LEVEL_NAMES;
}

function readValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function printReports(reports: readonly BenchmarkReport[]): void {
  console.table(
    reports.map((report) => ({
      level: report.levelName,
      frames: report.frames,
      drawCalls: report.counters.maxDrawCalls,
      triangles: report.counters.maxTriangles,
      programs: report.counters.maxPrograms,
      medianMs: round(report.timing.medianMilliseconds),
      p95Ms: round(report.timing.p95Milliseconds),
      p99Ms: round(report.timing.p99Milliseconds),
      missed: report.timing.missedFrames,
      longestRun: report.timing.longestMissedRunFrames,
      queuePeak: report.streaming.maxQueueSize,
    })),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Returns true when the run is incomplete and must not report success. */
function reportFailures(failures: readonly LevelFailure[]): boolean {
  if (failures.length === 0) return false;

  console.error(`${failures.length} level(s) produced no report:`);
  for (const { levelName, reason } of failures) {
    console.error(`  ${levelName}: ${reason}`);
  }
  return true;
}

/** The readable artifact is the deliverable; the JSON keeps every raw value. */
async function writeArtifacts(
  options: RunOptions,
  conditions: BenchmarkConditions,
  reports: readonly BenchmarkReport[],
  failures: readonly LevelFailure[],
): Promise<void> {
  await mkdir(options.outputDirectory, { recursive: true });
  const base = `${options.outputDirectory}/${options.profileName}`;

  await writeFile(
    `${base}.json`,
    `${JSON.stringify({ conditions, reports, failures }, undefined, 2)}\n`,
  );
  await writeFile(
    `${base}.md`,
    renderBenchmarkArtifact(conditions, reports, failures),
  );
  console.log(`Wrote ${base}.md and ${base}.json`);
}
