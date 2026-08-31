/**
 * Purpose: Replay the benchmark route for each level in a pinned Chromium.
 * Context: The measurement runs in the page; this file only drives the browser.
 * Responsibility: Launch Chromium, open each level, and collect its report.
 * Boundary: Option parsing, artifacts, and baselines stay in sibling files.
 */

import { type Browser, chromium, type Page } from "playwright";
import type { BenchmarkReport } from "../../src/benchmark/benchmark-report";
import type { BenchmarkProfileName } from "../../src/benchmark/benchmark-settings";
import type { LevelName } from "../../src/levels/level-catalog";
import type { BenchmarkConditions, LevelFailure } from "./benchmark-artifact";

const PROGRESS_INTERVAL_MILLISECONDS = 20_000;

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
  const browser = await launchBrowser(request.isHeaded);
  const reports: BenchmarkReport[] = [];
  const failures: LevelFailure[] = [];

  try {
    for (const levelName of request.levelNames) {
      const outcome = await runOneLevel(browser, request, levelName);
      if ("report" in outcome) reports.push(outcome.report);
      else failures.push(outcome.failure);
    }
    return { reports, failures, conditions: describeRun(request, browser) };
  } finally {
    await browser.close();
  }
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
  console.log(`Running ${levelName} (${request.profileName}) ...`);
  const startedAt = Date.now();

  try {
    const report = await replayLevel(browser, request, levelName);
    console.log(`  done in ${secondsSince(startedAt)}`);
    return { report };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`  failed after ${secondsSince(startedAt)}: ${reason}`);
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

/** A dense level renders for minutes under software rendering; say so. */
function reportProgress(page: Page): () => void {
  const interval = setInterval(() => {
    void page
      .evaluate(() => window.benchmarkProgress)
      .then((progress) => {
        if (!progress) return;
        console.log(`  frame ${progress.frames} / ${progress.totalFrames}`);
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
    rendering: request.isHeaded
      ? "headed Chromium on this machine's GPU"
      : "headless Chromium with SwiftShader software rendering",
    browserVersion: browser.version(),
  };
}

function secondsSince(startedAt: number): string {
  return `${Math.round((Date.now() - startedAt) / 1000)}s`;
}
