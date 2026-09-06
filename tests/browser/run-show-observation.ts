/**
 * Purpose: Observe real-speed show playback and sought cold transitions.
 * Context: Deterministic replay does not exercise production audio and scheduling.
 * Responsibility: Collect bounded desktop intervals, clock progress, and failures.
 * Boundary: No runtime hooks, timer replacement, GPU timing, or device acceptance.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "playwright";
import { summarizeFrameTimes } from "../../src/benchmark/benchmark-report";
import { narrationUrl } from "../../src/dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import {
  assertRefactorBranch,
  collectBrowserErrors,
  readRenderingInfo,
  readRunIdentity,
} from "./browser-evidence";

const VIEWPORT = { width: 1280, height: 720 };
const TRANSITION_LEAD_SECONDS = 2;
const TRANSITION_DURATION_SECONDS = 10;
const REFERENCE_FRAME_MS = 1000 / 90;
const MAX_AUDIO_RECORDS = 100;
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "base-url": { type: "string", default: "http://localhost:4180" },
    mode: { type: "string", default: "transitions" },
    language: { type: "string", default: "en" },
    out: { type: "string" },
  },
});
if (values.mode !== "transitions" && values.mode !== "full") {
  throw new Error("--mode must be transitions or full");
}
if (values.language !== "en" && values.language !== "de") {
  throw new Error("--language must be en or de");
}
const language = values.language;
const output = resolve(
  values.out ?? `benchmark-results/show-${values.mode}-${Date.now()}`,
);
const requiredAudioPaths = PIECE_SCHEDULE.narration.map((cue) =>
  narrationUrl(cue.cueId, language),
);
const scenarios =
  values.mode === "full"
    ? [
        {
          cue: "full-show",
          target: 0,
          duration: PIECE_SCHEDULE.durationSeconds + 1,
          passes: ["uninterrupted"],
        },
      ]
    : PIECE_SCHEDULE.narration.map((cue) => ({
        cue: cue.cueId,
        target: Math.max(0, cue.atSeconds - TRANSITION_LEAD_SECONDS),
        duration: TRANSITION_DURATION_SECONDS,
        passes: ["first-sought-crossing", "repeated-sought-crossing"],
      }));

async function sampleFrames(page: Page, durationSeconds: number) {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const startedAt = performance.now();
  const progress = setInterval(() => {
    const elapsed = Math.round((performance.now() - startedAt) / 1000);
    console.log(`Observing show: ${elapsed}/${durationSeconds} wall seconds`);
  }, 30_000);
  try {
    return await Promise.race([
      page.evaluate(
        ({ durationSeconds }) =>
          new Promise<{
            intervalsMs: number[];
            startSeconds: number;
            endSeconds: number;
            elapsedSeconds: number;
            timeScale: number;
            capped: boolean;
            hidden: boolean;
          }>((finish) => {
            const clock = window.showClock;
            if (!clock) throw new Error("Show clock is unavailable");
            const startedAt = performance.now();
            const startSeconds = clock.sample().timeSeconds;
            const intervalsMs: number[] = [];
            const sampleCap = Math.ceil(durationSeconds * 240);
            let previous: number | undefined;
            let frame = 0;
            let hidden = document.hidden;
            const recordVisibility = () => {
              hidden ||= document.hidden;
            };
            document.addEventListener("visibilitychange", recordVisibility);
            const stop = () => {
              cancelAnimationFrame(frame);
              clearTimeout(timer);
              recordVisibility();
              document.removeEventListener(
                "visibilitychange",
                recordVisibility,
              );
              const sample = clock.sample();
              finish({
                intervalsMs,
                startSeconds,
                endSeconds: sample.timeSeconds,
                elapsedSeconds: (performance.now() - startedAt) / 1000,
                timeScale: sample.timeScale,
                capped: intervalsMs.length >= sampleCap,
                hidden,
              });
            };
            const tick = (now: number) => {
              if (previous !== undefined) intervalsMs.push(now - previous);
              previous = now;
              const deadlineReached = now - startedAt >= durationSeconds * 1000;
              const capacityReached = intervalsMs.length >= sampleCap;
              if (deadlineReached || capacityReached) {
                stop();
                return;
              }
              frame = requestAnimationFrame(tick);
            };
            const timer = setTimeout(stop, durationSeconds * 1000);
            frame = requestAnimationFrame(tick);
          }),
        { durationSeconds },
      ),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error("Show observation exceeded its deadline")),
          (durationSeconds + 20) * 1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(deadline);
    clearInterval(progress);
  }
}

function collectNarrationEvidence(page: Page) {
  const audio = {
    warnings: [] as string[],
    responses: [] as { path: string; status: number }[],
    warningCount: 0,
    responseCount: 0,
    successfulPaths: new Set<string>(),
  };
  page.on("console", (message) => {
    if (message.type() !== "warning") return;
    if (!/audio|narration|tone/i.test(message.text())) return;
    audio.warningCount++;
    if (audio.warnings.length < MAX_AUDIO_RECORDS)
      audio.warnings.push(message.text());
  });
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (!requiredAudioPaths.includes(path)) return;
    audio.responseCount++;
    if (response.ok()) audio.successfulPaths.add(path);
    if (audio.responses.length < MAX_AUDIO_RECORDS) {
      audio.responses.push({ path, status: response.status() });
    }
  });
  return audio;
}

async function loadShow(page: Page, url: URL) {
  const startedAt = performance.now();
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.showClock !== undefined);
  await page.locator("canvas").first().waitFor({ state: "visible" });
  const readinessMs = performance.now() - startedAt;
  await page.bringToFront();
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  const selectedLanguage = page.getByRole("button", {
    name: language.toUpperCase(),
    exact: true,
  });
  if ((await selectedLanguage.getAttribute("aria-pressed")) !== "true") {
    throw new Error("The requested narration language is not active");
  }
  return { readinessMs, rendering: await readRenderingInfo(page) };
}

function verifyFrameCollection(
  observation: Awaited<ReturnType<typeof sampleFrames>>,
) {
  if (observation.capped)
    throw new Error("Frame observation reached its capacity");
  if (observation.hidden) throw new Error("The measured page was hidden");
  if (observation.intervalsMs.length === 0)
    throw new Error("Frame observation was empty");
}

async function observePlayback(page: Page, target: number, duration: number) {
  await page.evaluate((target) => window.showClock?.seekTo(target), target);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const observation = await sampleFrames(page, duration);
  if (await page.evaluate(() => window.showClock?.sample().isPlaying)) {
    await page.getByRole("button", { name: "Hold", exact: true }).click();
  }
  const {
    medianMilliseconds,
    p95Milliseconds,
    p99Milliseconds,
    maxMilliseconds,
  } = summarizeFrameTimes(observation.intervalsMs, REFERENCE_FRAME_MS);
  return {
    ...observation,
    frames: {
      count: observation.intervalsMs.length,
      medianMilliseconds,
      p95Milliseconds,
      p99Milliseconds,
      maxMilliseconds,
    },
  };
}

async function observeShow(
  browser: Browser,
  scenario: (typeof scenarios)[number],
) {
  assertRefactorBranch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  let errors = collectBrowserErrors(page);
  const audio = collectNarrationEvidence(page);
  const observations: (Awaited<ReturnType<typeof observePlayback>> & {
    pass: string;
  })[] = [];
  const url = new URL(`/?language=${language}`, values["base-url"]);
  let startup: Awaited<ReturnType<typeof loadShow>> | undefined;
  try {
    startup = await loadShow(page, url);
    const { target, duration } = scenario;
    for (const pass of scenario.passes) {
      const observation = await observePlayback(page, target, duration);
      observations.push({ pass, ...observation });
      verifyFrameCollection(observation);
      verifyClockProgress(
        observation,
        Math.min(target + duration, PIECE_SCHEDULE.durationSeconds),
      );
    }
    const missingAudio = requiredAudioPaths.filter(
      (path) => !audio.successfulPaths.has(path),
    );
    errors.push(
      ...missingAudio.map(
        (path) => `Required narration response missing: ${path}`,
      ),
    );
  } catch (error) {
    errors.push(String(error));
  } finally {
    // Closing the context intentionally aborts requests; freeze run failures first.
    errors = [...errors];
    await context.close().catch((error: unknown) => errors.push(String(error)));
  }
  return {
    cue: scenario.cue,
    url: url.href,
    ...startup,
    audioResponses: audio.responses,
    audioWarnings: audio.warnings,
    audioResponseCount: audio.responseCount,
    audioWarningCount: audio.warningCount,
    errors,
    observations,
  };
}

function verifyClockProgress(
  observation: Awaited<ReturnType<typeof sampleFrames>>,
  expectedEnd: number,
) {
  if (observation.timeScale !== 1 || observation.endSeconds < expectedEnd - 1) {
    throw new Error("The audio-backed clock did not advance at real speed");
  }
}

assertRefactorBranch();
const identity = readRunIdentity();
const results: Awaited<ReturnType<typeof observeShow>>[] = [];
const errors: string[] = [];
let browser: Browser | undefined;
let browserVersion: string | undefined;
try {
  browser = await chromium.launch({ headless: false });
  browserVersion = browser.version();
  for (const scenario of scenarios) {
    results.push(await observeShow(browser, scenario));
  }
} catch (error) {
  errors.push(String(error));
} finally {
  await browser?.close().catch((error: unknown) => errors.push(String(error)));
  const passed =
    errors.length === 0 &&
    results.length > 0 &&
    results.every((result) => result.errors.length === 0);
  assertRefactorBranch();
  await mkdir(output, { recursive: true });
  assertRefactorBranch();
  await writeFile(
    resolve(output, "show-observation.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        command: Bun.argv,
        identity,
        mode: values.mode,
        language,
        browserVersion,
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        headed: true,
        frameRateFlags: "Browser defaults; no vsync or timer override",
        limitations: [
          "Sought transitions are not full-show or natural preceding-workload evidence.",
          "Clock advancement and successful audio responses do not prove audible narration or organ output.",
          "External RAF intervals are not renderer counters, GPU duration, or PICO acceptance.",
          "Power/display conditions and absence of competing workloads require the operator record.",
        ],
        passed,
        errors,
        results,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    `${passed ? "PASS" : "FAIL"}: ${resolve(output, "show-observation.json")}`,
  );
  if (!passed) process.exitCode = 1;
}
