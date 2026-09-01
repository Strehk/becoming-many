/**
 * Purpose: Turn the `bun run benchmark` command line into one run request.
 * Context: A run takes minutes, so a mistyped flag must fail before it starts.
 * Responsibility: Parse and validate flags, and describe them on request.
 * Boundary: Running the levels, artifacts, and baselines live in sibling files.
 */

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

const DEFAULT_RESULTS_DIRECTORY = "benchmark-results";
const DEFAULT_LEVEL_TIMEOUT_SECONDS = 600;

/** Everything one run needs, with every default already resolved. */
export interface RunOptions {
  readonly profileName: BenchmarkProfileName;
  readonly levelNames: readonly LevelName[];
  readonly baseUrl: string | undefined;
  readonly outputDirectory: string;
  readonly levelTimeoutMilliseconds: number;
  readonly isHeaded: boolean;
  readonly shouldCheck: boolean;
  readonly shouldUpdate: boolean;
}

export function wantsHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

export function readOptions(argv: readonly string[]): RunOptions {
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

/**
 * Repeatable `--level` and `--skip-level`; every level runs when none is
 * named. Skipping wins over naming, so `--skip-level` always removes a level.
 */
function readLevelNames(argv: readonly string[]): readonly LevelName[] {
  const requested = readLevelValues(argv, "--level");
  const skipped = new Set(readLevelValues(argv, "--skip-level"));
  const selected = (requested.length > 0 ? requested : LEVEL_NAMES).filter(
    (name) => !skipped.has(name),
  );

  if (selected.length === 0) {
    throw new Error("Every level was skipped, so there is nothing to measure.");
  }
  return selected;
}

function readLevelValues(
  argv: readonly string[],
  flag: string,
): readonly LevelName[] {
  const values = argv.flatMap((entry, index) =>
    entry === flag ? [argv[index + 1] ?? ""] : [],
  );
  for (const name of values) {
    if (!isLevelName(name)) {
      throw new Error(
        `Unknown level "${name}". Use one of: ${LEVEL_NAMES.join(", ")}`,
      );
    }
  }
  return values as LevelName[];
}

function readValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** The `--help` text; the README explains the same flags at more length. */
export function describeUsage(): string {
  return [
    "Usage: bun run benchmark [options]",
    "",
    "Replays a fixed route through each level in Chromium and writes one",
    "report artifact. Needs a current `bun run build`.",
    "",
    "Options:",
    ...describeFlags([
      [
        `--profile <${BENCHMARK_PROFILE_NAMES.join("|")}>`,
        'Replay density. Defaults to "full".',
      ],
      [
        "--level <name>",
        "Measure only this level. Repeatable; defaults to every level.",
      ],
      [
        "--skip-level <name>",
        "Leave this level out. Repeatable, and wins over --level.",
      ],
      [
        "--headed",
        "Use this machine's GPU. Headless renders in software instead.",
      ],
      [
        "--out <dir>",
        `Artifact directory. Defaults to "${DEFAULT_RESULTS_DIRECTORY}".`,
      ],
      [
        "--timeout <seconds>",
        `Per-level cap. Defaults to ${DEFAULT_LEVEL_TIMEOUT_SECONDS}.`,
      ],
      ["--check", "Fail when counters differ from the accepted baseline."],
      ["--update", "Accept the measured counters into the baseline."],
      ["--base-url <url>", "Measure an already running server."],
      ["-h, --help", "Print this text and measure nothing."],
    ]),
    "",
    `Levels: ${LEVEL_NAMES.join(", ")}`,
    "",
    "Examples:",
    "  bun run benchmark --profile quick --level magnetic",
    "  bun run benchmark --skip-level test --skip-level design-test",
  ].join("\n");
}

/** Aligns the descriptions into a column so the list reads as a table. */
function describeFlags(
  flags: readonly (readonly [string, string])[],
): string[] {
  const width = Math.max(...flags.map(([flag]) => flag.length));
  return flags.map(([flag, meaning]) => `  ${flag.padEnd(width)}  ${meaning}`);
}
