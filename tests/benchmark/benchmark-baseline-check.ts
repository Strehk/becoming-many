/**
 * Purpose: Compare measured counters against the accepted baseline and rewrite it.
 * Context: Counters are exact integers, so a difference is a real scene change.
 * Responsibility: Gate a run and regenerate the typed baseline file on request.
 * Boundary: Browser driving, artifacts, and frame times stay outside.
 */

import { writeFile } from "node:fs/promises";
import type { BenchmarkReport } from "../../src/benchmark/benchmark-report";
import {
  BENCHMARK_PROFILE_NAMES,
  type BenchmarkProfileName,
} from "../../src/benchmark/benchmark-settings";
import type { LevelName } from "../../src/levels/level-catalog";
import { BENCHMARK_BASELINE } from "./benchmark-baseline";

const BASELINE_PATH = "tests/benchmark/benchmark-baseline.ts";

type BaselineDraft = Record<
  BenchmarkProfileName,
  Partial<Record<LevelName, BenchmarkReport["counters"]>>
>;

/** Counters are exact, so a gate compares them without tolerance. */
export function checkBaseline(
  profileName: BenchmarkProfileName,
  reports: readonly BenchmarkReport[],
): boolean {
  const accepted = BENCHMARK_BASELINE[profileName];
  const differences = reports.flatMap((report) =>
    compareCounters(report, accepted[report.levelName as LevelName]),
  );

  if (differences.length === 0) {
    console.log("Counters match the baseline.");
    return true;
  }

  console.error("Counter regression:");
  for (const difference of differences) console.error(`  ${difference}`);
  console.error(
    `Accept the change with: bun run benchmark --profile ${profileName} --update`,
  );
  return false;
}

function compareCounters(
  report: BenchmarkReport,
  expected: BenchmarkReport["counters"] | undefined,
): string[] {
  if (!expected) {
    console.log(`  ${report.levelName}: not gated, skipped`);
    return [];
  }

  return Object.entries(expected).flatMap(([key, value]) => {
    const measured = report.counters[key as keyof typeof expected];
    return measured === value
      ? []
      : [`${report.levelName}.${key}: expected ${value}, measured ${measured}`];
  });
}

export async function updateBaseline(
  profileName: BenchmarkProfileName,
  reports: readonly BenchmarkReport[],
): Promise<void> {
  const updated: BaselineDraft = {
    full: { ...BENCHMARK_BASELINE.full },
    quick: { ...BENCHMARK_BASELINE.quick },
  };
  for (const report of reports) {
    updated[profileName][report.levelName as LevelName] = report.counters;
  }

  await writeFile(BASELINE_PATH, renderBaselineFile(updated));
  console.log(`Updated ${BASELINE_PATH}`);
}

function renderBaselineFile(baseline: BaselineDraft): string {
  const profiles = BENCHMARK_PROFILE_NAMES.map(
    (name) => `  ${name}: ${renderProfile(baseline[name])},`,
  ).join("\n");

  return `/**
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
 * Regenerate with \`bun run benchmark --profile <name> --update\`. Only levels
 * listed here are checked, so a level is gated by adding it deliberately.
 */
export const BENCHMARK_BASELINE: BenchmarkBaseline = {
${profiles}
};
`;
}

/** Emit the formatter's own quoting so an update never leaves lint failing. */
function asKey(levelName: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(levelName)
    ? levelName
    : JSON.stringify(levelName);
}

function renderProfile(
  levels: Partial<Record<LevelName, BenchmarkReport["counters"]>>,
): string {
  const entries = Object.entries(levels);
  if (entries.length === 0) return "{}";

  const body = entries
    .map(([levelName, counters]) => {
      const fields = Object.entries(counters ?? {})
        .map(([key, value]) => `      ${key}: ${value},`)
        .join("\n");
      return `    ${asKey(levelName)}: {\n${fields}\n    },`;
    })
    .join("\n");
  return `{\n${body}\n  }`;
}
