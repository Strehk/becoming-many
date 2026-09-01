/**
 * Purpose: Replay the benchmark route for each level in a pinned Chromium.
 * Context: The measurement runs in the page; this file only drives the browser.
 * Responsibility: Launch Chromium, open each level, and collect its report.
 * Boundary: Option parsing, artifacts, and baselines stay in sibling files.
 */

import { type Browser, chromium, type Page } from "playwright";
import type { BenchmarkReport } from "../../src/benchmark/benchmark-report";
import { benchmarkFrameCount } from "../../src/benchmark/benchmark-run";
import type { BenchmarkProfileName } from "../../src/benchmark/benchmark-settings";
import type { LevelName } from "../../src/levels/level-catalog";
import type { BenchmarkConditions, LevelFailure } from "./benchmark-artifact";
import {
  describeLevelProgress,
  describeRemainingLevels,
  formatDuration,
  type ProgressObservation,
} from "./benchmark-progress";

const PROGRESS_INTERVAL_MILLISECONDS = 10_000;

// Frustum culling depends on the camera aspect ratio, so the viewport is part
// of the workload and must be pinned. Both profiles share one aspect ratio, so
// the quick profile changes resolution cost without changing what is culled.
const VIEWPORT_BY_PROFILE = {
  full: { width: 1280, height: 720 },
  quick: { width: 640, height: 360 },
} as const;

export interface BrowserRunRequest {
  readonly profileName: BenchmarkProfileName;
  readonly levelNames: readonly LevelName[];
  readonly baseUrl: string;
  readonly isHeaded: boolean;
  readonly levelTimeoutMilliseconds: number;
}

export interface BrowserRunResult {
  readonly reports: readonly BenchmarkReport[];
  readonly failures: readonly LevelFailure[];
  readonly conditions: BenchmarkConditions;
}

export async function runLevelsInBrowser(
  request: BrowserRunRequest,
): Promise<BrowserRunResult> {
  announceRun(request);

  const browser = await launchBrowser(request.isHeaded);
  const reports: BenchmarkReport[] = [];
  const failures: LevelFailure[] = [];
  // Wall-clock cost of the levels already finished, which is the only basis
  // this run has for estimating the levels it has not started.
  const finishedMilliseconds: number[] = [];
  const startedAt = Date.now();

  try {
    for (const [index, levelName] of request.levelNames.entries()) {
      const levelStartedAt = Date.now();
      console.log(
        `[${index + 1}/${request.levelNames.length}] ${levelName} ...`,
      );

      const outcome = await runOneLevel(browser, request, levelName);
      if ("report" in outcome) reports.push(outcome.report);
      else failures.push(outcome.failure);

      finishedMilliseconds.push(Date.now() - levelStartedAt);
      announceLevelEnd(request, finishedMilliseconds, index);
    }

    console.log(
      `Ran ${request.levelNames.length} level(s) in ${formatDuration(Date.now() - startedAt)}.`,
    );
    return { reports, failures, conditions: describeRun(request, browser) };
  } finally {
    await browser.close();
  }
}

/** What the run is about to do, so its duration is knowable before it starts. */
function announceRun(request: BrowserRunRequest): void {
  const frames = benchmarkFrameCount(request.profileName);
  const worstCaseMilliseconds =
    request.levelNames.length * request.levelTimeoutMilliseconds;

  console.log(
    `Benchmarking ${request.levelNames.length} level(s) at profile "${request.profileName}", ${frames} frames each.`,
  );
  console.log(`Rendering: ${describeRendering(request.isHeaded)}.`);
  console.log(
    `Per-level timeout ${formatDuration(request.levelTimeoutMilliseconds)}, so the run ends after at most ${formatDuration(worstCaseMilliseconds)}.`,
  );
}

function announceLevelEnd(
  request: BrowserRunRequest,
  finishedMilliseconds: readonly number[],
  index: number,
): void {
  const remaining = describeRemainingLevels(
    finishedMilliseconds,
    request.levelNames.length - finishedMilliseconds.length,
  );
  const took = formatDuration(finishedMilliseconds[index] ?? 0);
  console.log(`  ${took} for this level${remaining ? ` · ${remaining}` : ""}`);
}

type LevelOutcome =
  | { readonly report: BenchmarkReport }
  | { readonly failure: LevelFailure };

/** One level that cannot finish must not discard the levels that did. */
async function runOneLevel(
  browser: Browser,
  request: BrowserRunRequest,
  levelName: LevelName,
): Promise<LevelOutcome> {
  try {
    return { report: await replayLevel(browser, request, levelName) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`  failed: ${reason}`);
    return { failure: { levelName, reason: reason.split("\n")[0] ?? reason } };
  }
}

async function replayLevel(
  browser: Browser,
  request: BrowserRunRequest,
  levelName: LevelName,
): Promise<BenchmarkReport> {
  const context = await browser.newContext({
    viewport: VIEWPORT_BY_PROFILE[request.profileName],
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(request.levelTimeoutMilliseconds);
  context.setDefaultNavigationTimeout(request.levelTimeoutMilliseconds);

  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(`  page error: ${error}`));

  try {
    await page.goto(
      `${request.baseUrl}/?level=${levelName}&benchmark=${request.profileName}`,
      { waitUntil: "load" },
    );
    await waitForReport(page);

    const report = await page.evaluate(() => window.benchmarkReport);
    if (!report) throw new Error(`No report produced for level ${levelName}`);
    return report;
  } finally {
    // Never let a close error replace the failure that caused it.
    await context.close().catch(() => undefined);
  }
}

async function waitForReport(page: Page): Promise<void> {
  const reportReady = page.waitForFunction(
    () => window.benchmarkReport !== undefined,
  );
  const stopProgress = reportProgress(page);

  try {
    await reportReady;
  } finally {
    stopProgress();
  }
}

/** A dense level renders for minutes under software rendering; say how far. */
function reportProgress(page: Page): () => void {
  const startedAt = Date.now();
  let previous: ProgressObservation | undefined;

  const interval = setInterval(() => {
    void page
      .evaluate(() => window.benchmarkProgress)
      .then((progress) => {
        const elapsedMilliseconds = Date.now() - startedAt;
        if (!progress) {
          console.log(
            `  loading · ${formatDuration(elapsedMilliseconds)} elapsed`,
          );
          return;
        }

        const current = { ...progress, elapsedMilliseconds };
        console.log(`  ${describeLevelProgress(current, previous)}`);
        previous = current;
      })
      .catch(() => undefined);
  }, PROGRESS_INTERVAL_MILLISECONDS);

  return () => clearInterval(interval);
}

function launchBrowser(isHeaded: boolean): Promise<Browser> {
  return chromium.launch({
    headless: !isHeaded,
    args: [
      // Without these the animation loop is clamped to the display refresh and
      // every frame time reads as the vsync interval instead of the real cost.
      "--disable-gpu-vsync",
      "--disable-frame-rate-limit",
      // Without a GPU, SwiftShader keeps counters exact while frame times then
      // describe the software rasterizer. Use --headed on a machine with a GPU
      // to measure timing that means anything.
      ...(isHeaded ? [] : ["--enable-unsafe-swiftshader"]),
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
    ],
  });
}

function describeRun(
  request: BrowserRunRequest,
  browser: Browser,
): BenchmarkConditions {
  return {
    profileName: request.profileName,
    generatedAt: new Date().toISOString(),
    viewport: VIEWPORT_BY_PROFILE[request.profileName],
    rendering: describeRendering(request.isHeaded),
    browserVersion: browser.version(),
  };
}

function describeRendering(isHeaded: boolean): string {
  return isHeaded
    ? "headed Chromium on this machine's GPU"
    : "headless Chromium with SwiftShader software rendering";
}
