/**
 * Purpose: Verify browser entries and operator controls in a real browser.
 * Context: Contract tests cannot prove that built pages render and respond.
 * Responsibility: Exercise existing controls and retain evidence of failures.
 * Boundary: The server is started separately; no physical device writes or timing claims.
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "playwright";
import { LEVEL_NAMES } from "../../shared/level-routes";
import { narrationUrl } from "../../src/dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import { M5_FIRMWARE_VERSION } from "../../src/m5/protocol";
import {
  assertRefactorBranch,
  collectBrowserErrors,
  readRenderingInfo,
  readRunIdentity,
} from "./browser-evidence";

import { checkFlashLifecycle } from "./flash-acceptance";
import {
  checkStartLevel,
  checkStartTimeout,
  flyStartCourse,
  prepareStartInput,
  type StartSimulation,
} from "./start-acceptance";
import { checkStartupFailure } from "./startup-failure";
import { checkUiMountFailure } from "./ui-mount-failure";

const READY_TIMEOUT_MILLISECONDS = 90_000;
const PAUSE_OBSERVATION_MILLISECONDS = 1_100;
const VIEWPORT = { width: 1280, height: 720 };
const ECHO_CUE = PIECE_SCHEDULE.narration.find((cue) => cue.cueId === "echo");
assert(ECHO_CUE, "The smoke needs the existing Echo cue");
const ECHO_START_SECONDS = ECHO_CUE.atSeconds;
const ECHO_CUE_KEY = `Digit${PIECE_SCHEDULE.narration.indexOf(ECHO_CUE) + 1}`;
const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:4180" },
    out: { type: "string", default: `benchmark-results/browser/${Date.now()}` },
    headless: { type: "boolean", default: false },
    dev: { type: "boolean", default: false },
    route: { type: "string", multiple: true },
  },
});
const baseUrl = new URL(values["base-url"]).origin;
const outputDirectory = values.out;

interface SmokeResult {
  readonly route: string;
  readonly passed: boolean;
  readonly errors: readonly string[];
  readonly rendering?: Awaited<ReturnType<typeof readRenderingInfo>>;
  readonly conductorWakeRequired?: boolean;
}

await main();

async function main(): Promise<void> {
  assertRefactorBranch();
  const availableRoutes = [
    "/",
    "/?level=echo",
    "/?level=start",
    "/conductor.html",
    "/flash.html",
    ...LEVEL_NAMES.map((level) => `/${level}`),
  ];
  const selectedRoutes = values.route
    ? [...new Set(values.route)]
    : availableRoutes;
  for (const route of selectedRoutes) {
    assert(
      availableRoutes.includes(route),
      `Unknown smoke route: ${route}. Available routes: ${availableRoutes.join(", ")}`,
    );
  }
  const identity = readRunIdentity();
  const results: SmokeResult[] = [];
  await mkdir(outputDirectory, { recursive: true });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: values.headless });
    if (!values.dev) {
      await checkStationHealth();
      await checkStationConfig();
    }
    for (const [index, route] of selectedRoutes.entries()) {
      const result = await runSmokeRoute(browser, route, index);
      results.push(result);
      console.log(
        `${result.passed ? "PASS" : "FAIL"} ${route}: ${result.errors.join("; ")}`,
      );
    }
    for (const { name, routes, check } of [
      {
        name: "startup-failure",
        routes: ["/", "/?level=echo", "/conductor.html"],
        check: checkStartupFailure,
      },
      {
        name: "ui-mount-failure",
        routes: ["/", "/conductor.html", "/flash.html"],
        check: checkUiMountFailure,
      },
    ]) {
      for (const route of routes) {
        if (!selectedRoutes.includes(route)) continue;
        const scenario = `${name}:${route}`;
        try {
          await check(
            browser,
            baseUrl,
            route,
            join(
              outputDirectory,
              `${name}-${route === "/" ? "rehearsal" : route.slice(1)}.png`,
            ),
          );
          results.push({ route: scenario, passed: true, errors: [] });
          console.log(`PASS ${scenario}`);
        } catch (error) {
          results.push({
            route: scenario,
            passed: false,
            errors: [String(error)],
          });
          console.log(`FAIL ${scenario}: ${String(error)}`);
        }
      }
    }
  } catch (error) {
    results.push({ route: "harness", passed: false, errors: [String(error)] });
  } finally {
    const browserVersion = browser?.version() ?? "unavailable";
    try {
      await browser?.close();
    } catch (error) {
      results.push({
        route: "cleanup",
        passed: false,
        errors: [String(error)],
      });
    }
    if (results.some((result) => !result.passed)) process.exitCode = 1;
    const report = {
      generatedAt: new Date().toISOString(),
      ...identity,
      baseUrl,
      browserVersion,
      headless: values.headless,
      dev: values.dev,
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      results,
    };
    assertRefactorBranch();
    await writeFile(
      join(outputDirectory, "smoke.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      { flag: "wx" },
    );
    console.log(`Evidence: ${outputDirectory}/smoke.json`);
  }
}

/** One route owns one fresh context; teardown failures remain in its result. */
async function runSmokeRoute(
  browser: Browser,
  route: string,
  index: number,
): Promise<SmokeResult> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(READY_TIMEOUT_MILLISECONDS);
  const page = await context.newPage();
  const errors = collectBrowserErrors(page);
  const artifactBase = join(outputDirectory, String(index));
  let observation: EntryObservation = {};
  let reportedErrors: string[] = [];
  try {
    assertRefactorBranch();
    await context.tracing.start({ screenshots: true, snapshots: true });
    if (route === "/conductor.html") {
      await page.route(`${baseUrl}/config`, (request) =>
        request.fulfill({
          json: { m5DeviceId: "browser-smoke-m5" },
        }),
      );
    }
    const startInput = [
      "/start",
      "/?level=start",
      "/",
      "/conductor.html",
    ].includes(route)
      ? await prepareStartInput(page, baseUrl, route !== "/conductor.html")
      : undefined;
    await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
    assert.equal(
      page.url(),
      `${baseUrl}${route}`,
      "Entry URL must remain the requested route",
    );
    observation = await checkEntry(page, route, startInput);
    if (startInput && (route === "/start" || route === "/?level=start"))
      await checkStartLevel(page, startInput, artifactBase);
    assertRefactorBranch();
    await page.screenshot({
      path: `${artifactBase}-ready.png`,
      fullPage: true,
      caret: "initial",
    });
    if (
      ["/", "/?level=echo", "/conductor.html", "/flash.html"].includes(route)
    ) {
      await checkUiLayout(page, route);
      if (route === "/flash.html") await checkFlashLifecycle(page, baseUrl);
    }
    if (route === "/conductor.html") await checkConductorStop(page);
    if (["/", "/?level=echo", "/conductor.html"].includes(route)) {
      await page.evaluate(() =>
        window.dispatchEvent(
          new PageTransitionEvent("pagehide", { persisted: true }),
        ),
      );
      assert.equal(
        await page.evaluate(() =>
          document
            .querySelector("canvas")
            ?.getContext("webgl2")
            ?.isContextLost(),
        ),
        false,
        "A persisted page keeps its Run",
      );
      await page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent("pagehide")),
      );
      await page.waitForFunction(() =>
        document.querySelector("canvas")?.getContext("webgl2")?.isContextLost(),
      );
      assert.equal(
        await page.locator("canvas").count(),
        1,
        "Page exit releases WebGL while preserving declared page structure",
      );
      if (route === "/") {
        assert.equal(await page.evaluate(() => window.show), undefined);
        assert.equal(await page.locator("[data-rehearsal]").isVisible(), false);
        assert.equal(await page.locator("[data-sections] button").count(), 0);
      }
      if (route === "/?level=echo")
        assert.equal(await page.locator("[data-xr-entry]").isVisible(), false);
    }
    assert.equal(errors.length, 0, errors.join("\n"));
  } catch (error) {
    errors.push(String(error));
    assertRefactorBranch();
    await page
      .screenshot({
        path: `${artifactBase}-failure.png`,
        fullPage: true,
        caret: "initial",
      })
      .catch((error) => errors.push(`Screenshot failed: ${String(error)}`));
  } finally {
    // Closing a context aborts its pending requests; those are not page failures.
    reportedErrors = errors.slice();
    assertRefactorBranch();
    try {
      await context.tracing.stop(
        reportedErrors.length === 0
          ? undefined
          : { path: `${artifactBase}-trace.zip` },
      );
    } catch (error) {
      reportedErrors.push(`Trace cleanup failed: ${String(error)}`);
    }
    try {
      await context.close();
    } catch (error) {
      reportedErrors.push(`Context cleanup failed: ${String(error)}`);
    }
  }
  return {
    route,
    passed: reportedErrors.length === 0,
    errors: reportedErrors,
    ...observation,
  };
}

type EntryObservation = Pick<
  SmokeResult,
  "rendering" | "conductorWakeRequired"
>;

async function checkEntry(
  page: Page,
  route: string,
  startInput: StartSimulation | undefined,
): Promise<EntryObservation> {
  if (route === "/flash.html") {
    await checkFlash(page);
    return {};
  }
  if (route === "/conductor.html") {
    return {
      conductorWakeRequired: await checkConductor(page, startInput),
      rendering: await readRenderingInfo(page),
    };
  }
  await waitForLevel(page);
  if (route === "/") {
    assert(startInput);
    await flyStartCourse(page, startInput);
    await checkRehearsal(page);
    await page.reload({ waitUntil: "load" });
    await waitForLevel(page);
    await page.waitForFunction(
      () => window.show?.readTutorial()?.phase === "arrival",
    );
    await checkStartTimeout(page, startInput);
  } else
    assert.equal(
      await page.evaluate(() => window.show),
      undefined,
      "Static levels must not start a show",
    );
  return { rendering: await readRenderingInfo(page) };
}

async function checkStationHealth(): Promise<void> {
  const health = await fetch(`${baseUrl}/health`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(health.status, 200, "Station health endpoint must succeed");
  const healthBody: unknown = await health.json();
  assert(typeof healthBody === "object");
  assert(healthBody !== null);
  assert("status" in healthBody);
  assert.equal(healthBody.status, "ok");
  assert("uptimeSeconds" in healthBody);
  assert(typeof healthBody.uptimeSeconds === "number");
  assert(healthBody.uptimeSeconds >= 0);
}

async function checkStationConfig(): Promise<void> {
  const config = await fetch(`${baseUrl}/config`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(config.status, 200, "Station config endpoint must succeed");
  const configBody: unknown = await config.json();
  assert(typeof configBody === "object");
  assert(configBody !== null);
  assert(!Array.isArray(configBody));
  assert(
    Object.values(configBody).every((setting) => typeof setting === "string"),
    "Deployment facts must be strings",
  );
}

async function waitForLevel(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /^(VR not available|Enter VR)$/ })
    .waitFor();
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    return canvas !== null && canvas.width > 0 && canvas.height > 0;
  });
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "One entry owns one rendering canvas",
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        let frameHandle = 0;
        const timeout = setTimeout(() => {
          cancelAnimationFrame(frameHandle);
          reject(new Error("No two animation frames within five seconds"));
        }, 5_000);
        frameHandle = requestAnimationFrame(() => {
          frameHandle = requestAnimationFrame(() => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }),
  );
}

async function checkRehearsal(page: Page): Promise<void> {
  await page.waitForFunction(() => window.show !== undefined);
  const mainStartSeconds = await page.evaluate(
    () => window.show?.sample().mainStartSeconds,
  );
  assert(mainStartSeconds !== undefined);
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await page.waitForFunction(() => window.show?.sample().isPlaying === false);
  const pausedTime = await page.evaluate(
    () => window.show?.sample().timeSeconds,
  );
  // An elapsed observation window checks stability; it is not startup readiness.
  await page.waitForTimeout(PAUSE_OBSERVATION_MILLISECONDS);
  assert.equal(
    await page.evaluate(() => window.show?.sample().timeSeconds),
    pausedTime,
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    (before) => (window.show?.sample().timeSeconds ?? 0) > (before ?? 0) + 0.2,
    pausedTime,
  );
  await page.getByRole("button", { name: "DE", exact: true }).click();
  await page
    .locator('button[aria-pressed="true"]')
    .filter({ hasText: /^DE$/ })
    .waitFor();
  assert.equal(
    await page.evaluate(() => window.show?.sample().isPlaying),
    true,
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .locator('button[aria-pressed="true"]')
    .filter({ hasText: /^EN$/ })
    .waitFor();
  assert.equal(
    await page.evaluate(() => window.show?.sample().isPlaying),
    true,
  );
  await page.waitForFunction(
    (before) => (window.show?.sample().timeSeconds ?? 0) > (before ?? 0) + 0.4,
    pausedTime,
  );
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await page.waitForFunction(() => window.show?.sample().isPlaying === false);
  await page.getByRole("button", { name: "Echo", exact: true }).click();
  await page.waitForFunction(
    (seconds) => window.show?.sample().timeSeconds === seconds,
    mainStartSeconds + ECHO_START_SECONDS,
  );
  await page.getByRole("button", { name: "Prologue", exact: true }).click();
  await page.waitForFunction(
    (start) => window.show?.sample().timeSeconds === start,
    mainStartSeconds,
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    (start) => (window.show?.sample().timeSeconds ?? 0) > start + 0.2,
    mainStartSeconds,
  );
  await checkScrubbing(
    page,
    ".rehearsal__track",
    ".rehearsal button:first-child",
  );
}

async function checkConductor(
  page: Page,
  startInput: StartSimulation | undefined,
): Promise<boolean> {
  await page.locator(".conductor:not([inert])").waitFor();
  const wakeRequired = await page.locator(".conductor__wake").isVisible();
  if (wakeRequired) await page.locator(".conductor__wake").click();
  await page.locator(".conductor__wake").waitFor({ state: "hidden" });
  assert(startInput);
  await page
    .getByRole("button", { name: "Technician tools", exact: true })
    .click();
  await page.getByRole("textbox", { name: "M5 host" }).fill("http://m5.test");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await page
    .getByRole("button", { name: "Close technician tools", exact: true })
    .click();
  await flyStartCourse(page, startInput);
  await page
    .getByRole("button", { name: "Technician tools", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page
    .getByRole("button", { name: "Close technician tools", exact: true })
    .click();
  await page.locator(".conductor__transport-button").click();
  await page
    .locator('.conductor__transport-button[data-playing="false"]')
    .waitFor();
  await checkConductorTransport(page);
  await checkScrubbing(
    page,
    ".timeline__track",
    ".conductor__transport-button",
  );
  await checkConductorKeyboard(page);
  await checkConductorTimelineKeyboard(page);
  return wakeRequired;
}

/** Observe Conductor through its rendered timeline without an Engine test API. */
async function observeConductorTime(
  page: Page,
  expectedSeconds?: number,
): Promise<number> {
  const observation = await page.waitForFunction((expectedSeconds) => {
    const durationSeconds = Number(
      document
        .querySelector(".conductor__timeline-slider")
        ?.getAttribute("aria-valuemax"),
    );
    const position = document
      .querySelector(".timeline__playhead")
      ?.getAttribute("x1");
    const seconds =
      (Number.parseFloat(position ?? "NaN") / 100) * durationSeconds;
    const matches =
      expectedSeconds === undefined
        ? seconds > 0.2
        : Math.abs(seconds - expectedSeconds) < 0.000001;
    return matches ? { seconds } : undefined;
  }, expectedSeconds);
  const sample = await observation.jsonValue();
  await observation.dispose();
  assert(sample);
  return sample.seconds;
}

/** Read the retained tutorial duration from the visible timeline's total. */
async function readConductorMainStart(page: Page): Promise<number> {
  return (
    Number(
      await page
        .locator(".conductor__timeline-slider")
        .getAttribute("aria-valuemax"),
    ) - PIECE_SCHEDULE.durationSeconds
  );
}

/** Native focused controls and global transport shortcuts must both remain usable. */
async function checkConductorKeyboard(page: Page): Promise<void> {
  const transport = page.locator(".conductor__transport-button");
  for (const isPlaying of [true, false]) {
    await transport.click();
    await page
      .locator(`.conductor__transport-button[data-playing="${isPlaying}"]`)
      .waitFor();
    for (const language of ["de", "en"] as const) {
      // Let this language's preload finish before replacing its audio elements.
      const recordings = Promise.all(
        PIECE_SCHEDULE.narration.map((cue) =>
          page.waitForEvent("requestfinished", {
            predicate: (request) =>
              new URL(request.url()).pathname ===
              narrationUrl(cue.cueId, language),
          }),
        ),
      );
      const before = await observeConductorTime(page);
      const button = page.getByRole("button", {
        name: language.toUpperCase(),
        exact: true,
      });
      await button.press("Space");
      await recordings;
      await page.waitForFunction(
        (name) =>
          document
            .querySelector(`[data-language="${name}"]`)
            ?.getAttribute("aria-pressed") === "true",
        language.toLowerCase(),
      );
      assert.equal(
        await transport.getAttribute("data-playing"),
        String(isPlaying),
      );
      if (isPlaying) {
        await page.waitForFunction((before) => {
          const durationSeconds = Number(
            document
              .querySelector(".conductor__timeline-slider")
              ?.getAttribute("aria-valuemax"),
          );
          const position = document
            .querySelector(".timeline__playhead")
            ?.getAttribute("x1");
          return (
            (Number.parseFloat(position ?? "") / 100) * durationSeconds >
            before + 0.2
          );
        }, before);
      } else {
        assert.equal(await observeConductorTime(page), before);
      }
    }
  }
  await transport.press("Space");
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await transport.press("Space");
  await page
    .locator('.conductor__transport-button[data-playing="false"]')
    .waitFor();
  await page.getByRole("button", { name: /Echo/ }).press("Space");
  await observeConductorTime(
    page,
    (await readConductorMainStart(page)) + ECHO_START_SECONDS,
  );
  assert.equal(await transport.getAttribute("data-playing"), "false");
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await page.keyboard.press("Space");
  await page
    .locator('.conductor__transport-button[data-playing="false"]')
    .waitFor();
}

async function checkConductorTransport(page: Page): Promise<void> {
  const transport = page.locator(".conductor__transport-button");
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await observeConductorTime(page);
  await checkConductorTargets(page);
  const frames = await page.evaluate(async () => {
    const samples: { position: number; progress: number[] }[] = [];
    for (let frame = 0; frame < 12; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      samples.push({
        position: Number.parseFloat(
          document.querySelector(".timeline__playhead")?.getAttribute("x1") ??
            "",
        ),
        progress: [...document.querySelectorAll(".timeline__progress")].map(
          (bar) => Number.parseFloat(bar.getAttribute("width") ?? ""),
        ),
      });
    }
    return samples;
  });
  for (const [index, frame] of frames.entries()) {
    const previous = frames[index - 1];
    if (!previous) continue;
    assert(
      frame.position >= previous.position,
      "Playhead advances monotonically",
    );
    assert(
      frame.progress.every((width, chapter) => {
        const previousWidth = previous.progress[chapter];
        return previousWidth !== undefined && width >= previousWidth;
      }),
      "Chapter progress advances monotonically",
    );
  }
  const firstFrame = frames[0];
  const lastFrame = frames.at(-1);
  assert(firstFrame && lastFrame);
  assert(
    lastFrame.position > firstFrame.position,
    "Playback animates the timeline",
  );
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="false"]')
    .waitFor();
  const pausedTime = await observeConductorTime(page);
  const pausedProgress = await page
    .locator(".timeline__progress")
    .evaluateAll((bars) => bars.map((bar) => bar.getAttribute("width")));
  await page.waitForTimeout(PAUSE_OBSERVATION_MILLISECONDS);
  assert.equal(await observeConductorTime(page), pausedTime);
  assert.deepEqual(
    await page
      .locator(".timeline__progress")
      .evaluateAll((bars) => bars.map((bar) => bar.getAttribute("width"))),
    pausedProgress,
    "Pause freezes chapter progress as well as the playhead",
  );
}

/** The visible timeline exposes the same position to keyboard and assistive users. */
async function checkConductorTimelineKeyboard(page: Page): Promise<void> {
  const mainStartSeconds = await readConductorMainStart(page);
  const timeline = page.getByRole("slider");
  assert.equal(await timeline.getAttribute("aria-valuemin"), "0");
  assert.equal(
    Number(await timeline.getAttribute("aria-valuemax")),
    mainStartSeconds + PIECE_SCHEDULE.durationSeconds,
  );
  assert.equal(
    await page.locator(".conductor__chapters button").count(),
    PIECE_SCHEDULE.narration.length + 1,
  );
  for (const [key, seconds] of [
    ["Home", 0],
    ["ArrowRight", 5],
    ["Shift+ArrowRight", 35],
    ["ArrowLeft", 30],
    ["ArrowUp", 35],
    ["ArrowDown", 30],
    ["End", PIECE_SCHEDULE.durationSeconds],
  ] as const) {
    await timeline.press(key);
    await observeConductorTime(page, mainStartSeconds + seconds);
    assert.equal(
      Number(await timeline.getAttribute("aria-valuenow")),
      Math.floor(mainStartSeconds + seconds),
    );
    assert(await timeline.getAttribute("aria-valuetext"));
    assert.equal(
      await page
        .locator(".conductor__transport-button")
        .getAttribute("data-playing"),
      "false",
      "Keyboard seeking preserves paused playback",
    );
  }
  const currentChapter = page.locator(
    '.conductor__chapters [aria-pressed="true"]',
  );
  assert.equal(await currentChapter.count(), 1);
  assert.match(await currentChapter.innerText(), /Return/);
  await timeline.press("Home");
  await observeConductorTime(page, mainStartSeconds);
}

async function checkConductorStop(page: Page): Promise<void> {
  const transport = page.locator(".conductor__transport-button");
  await page.getByRole("button", { name: "DE", exact: true }).click();
  await page
    .locator('.conductor__language button[aria-pressed="true"]')
    .filter({ hasText: /^DE$/ })
    .waitFor();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .locator('.conductor__language button[aria-pressed="true"]')
    .filter({ hasText: /^EN$/ })
    .waitFor();
  await page.keyboard.press(ECHO_CUE_KEY);
  await observeConductorTime(
    page,
    (await readConductorMainStart(page)) + ECHO_START_SECONDS,
  );
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await observeConductorTime(page, 0);
  assert.equal(await transport.getAttribute("data-playing"), "false");
  await page.waitForFunction(
    () => window.show?.readTutorial()?.phase === "arrival",
  );
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await page.locator("[data-tutorial-status]").waitFor({ state: "visible" });
  assert.match(
    await page.locator("[data-tutorial-status]").innerText(),
    /Right · 1\/4/,
  );
  assert.equal(await page.locator("[data-continue-experience]").count(), 0);
  const restartedAt = await observeConductorTime(page);
  await page.waitForTimeout(PAUSE_OBSERVATION_MILLISECONDS);
  assert(
    (await observeConductorTime(page)) > restartedAt,
    "Playing tutorial advances the retained timeline",
  );
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "Restarting tutorial after Stop must reuse the existing renderer",
  );
}

/** Real pointer capture must restore playing/held state on release and cancel. */
async function checkScrubbing(
  page: Page,
  trackSelector: string,
  transportSelector: string,
): Promise<void> {
  const track = page.locator(trackSelector);
  const transport = page.locator(transportSelector).first();
  const isPlaying = () =>
    transport.evaluate(
      (button) =>
        button.dataset.playing === "true" || button.textContent === "Hold",
    );
  for (const resume of [true, false]) {
    if ((await isPlaying()) !== resume) await transport.click();
    await track.scrollIntoViewIfNeeded();
    const bounds = await track.boundingBox();
    assert(bounds, "Timeline must have usable geometry");
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(bounds.x + bounds.width * 0.1, y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.2, y, { steps: 3 });
    await page.waitForFunction((selector) => {
      const line = document.querySelector(
        `${selector} .timeline__playhead, ${selector} .rehearsal__playhead`,
      );
      return (
        Math.abs(Number.parseFloat(line?.getAttribute("x1") ?? "") - 20) < 0.1
      );
    }, trackSelector);
    assert.equal(await isPlaying(), false, "Scrubbing holds playback");
    if (resume) {
      await page.mouse.up();
    } else {
      // Dispatch cancellation for the real captured pointer, then release the mouse.
      await track.evaluate((element) => {
        for (let pointerId = 0; pointerId < 10; pointerId++) {
          if (element.hasPointerCapture(pointerId)) {
            const bounds = element.getBoundingClientRect();
            element.dispatchEvent(
              new PointerEvent("pointercancel", {
                pointerId,
                clientX: bounds.x + bounds.width * 0.2,
                clientY: bounds.y + bounds.height / 2,
              }),
            );
          }
        }
      });
      await page.mouse.up();
    }
    await page.waitForFunction(
      ({ selector, playing }) => {
        const button = document.querySelector<HTMLElement>(selector);
        return (
          (button?.dataset.playing === "true" ||
            button?.textContent === "Hold") === playing
        );
      },
      { selector: transportSelector, playing: resume },
    );
    const seconds =
      trackSelector === ".timeline__track"
        ? await observeConductorTime(page)
        : await page.evaluate(() => window.show?.sample().timeSeconds);
    const durationSeconds =
      (await page.evaluate(() => window.show?.sample().mainStartSeconds)) ??
      (await readConductorMainStart(page));
    const targetSeconds =
      (durationSeconds + PIECE_SCHEDULE.durationSeconds) * 0.2;
    assert(
      seconds !== undefined &&
        seconds >= targetSeconds - 0.1 &&
        seconds < targetSeconds + 1,
      "Drag seeks to the selected show position",
    );
  }
}

/** Shared styling must preserve each surface and its actual responsive controls. */
async function checkUiLayout(page: Page, route: string): Promise<void> {
  for (const width of route === "/conductor.html"
    ? [1672, VIEWPORT.width, 390]
    : [VIEWPORT.width, 390]) {
    await page.setViewportSize({
      width,
      height: width === 1672 ? 940 : VIEWPORT.height,
    });
    const layout = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyOverflow: getComputedStyle(document.body).overflowY,
    }));
    assert(
      layout.scrollWidth <= layout.viewportWidth,
      `${route}: horizontal overflow at ${width}`,
    );
    if (route === "/flash.html") {
      assert.notEqual(
        layout.bodyOverflow,
        "hidden",
        "Flash keeps vertical scrolling",
      );
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      assert(
        await page.evaluate(() => scrollY > 0),
        "Flash content remains reachable",
      );
    } else {
      assert.equal(await page.locator("canvas").count(), 1);
    }
    assert.equal(
      await page.locator("[style]:not(canvas)").count(),
      0,
      "Authored UI has no inline styles",
    );
    if (route === "/conductor.html") {
      await checkConductorTargets(page);
      const button = page.locator(".conductor__transport-button");
      const buttonBounds = await button.boundingBox();
      assert(buttonBounds);
      assert(
        buttonBounds.height >= 72,
        "Operator transport retains its touch target",
      );
      const stopBounds = await page
        .locator(".conductor__stop-button")
        .boundingBox();
      assert(
        stopBounds && stopBounds.height >= 72,
        "Stop retains its touch target",
      );
      const languageBounds = await page
        .locator(".conductor__language")
        .boundingBox();
      assert(
        languageBounds &&
          languageBounds.y >=
            Math.max(
              buttonBounds.y + buttonBounds.height,
              stopBounds.y + stopBounds.height,
            ),
        "Language controls remain below Play/Pause and Stop",
      );
      const previewBounds = await page
        .locator(".conductor__stage-mount canvas")
        .boundingBox();
      assert(
        previewBounds && previewBounds.width > 0 && previewBounds.height > 0,
        "The main surface keeps a usable scene preview",
      );
      assert.equal(await page.locator(".conductor__drawer canvas").count(), 0);
      const colors = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, text: style.color };
      });
      assert.notEqual(
        colors.background,
        colors.text,
        "Transport text contrasts with its surface",
      );
      assert.equal(
        colors.background,
        (await button.getAttribute("data-playing")) === "true"
          ? "rgb(242, 180, 92)"
          : "rgb(110, 231, 168)",
        "Transport state color survives shared button rules",
      );
      assert.equal(colors.text, "rgb(13, 19, 17)");
      await checkScrubbing(
        page,
        ".timeline__track",
        ".conductor__transport-button",
      );
    } else if (route === "/") {
      await checkScrubbing(
        page,
        ".rehearsal__track",
        ".rehearsal button:first-child",
      );
    }
    assertRefactorBranch();
    await page.screenshot({
      path: join(
        outputDirectory,
        `${route === "/" ? "rehearsal" : route.slice(1).replace(".html", "")}-${width}.png`,
      ),
      fullPage: true,
      caret: "initial",
    });
  }
  if (route === "/conductor.html") await checkTechnicianControls(page);
}

/** Imported glyphs must actually paint, and every operator button stays touchable. */
async function checkConductorTargets(page: Page): Promise<void> {
  for (const button of await page.locator(".conductor button:visible").all()) {
    const bounds = await button.boundingBox();
    assert(
      bounds && bounds.width >= 56 && bounds.height >= 56,
      `Button needs a 56px target: ${(await button.getAttribute("aria-label")) ?? (await button.innerText())}`,
    );
  }
  for (const icon of await page
    .locator(".conductor .lucide-icon:visible")
    .all()) {
    const glyph = await icon.evaluate((element) => {
      const bounds = (element as SVGSVGElement).getBBox();
      return { width: bounds.width, height: bounds.height };
    });
    assert(
      glyph.width > 0 && glyph.height > 0,
      "Visible Lucide icons contain painted geometry",
    );
  }
}

async function checkTechnicianControls(page: Page): Promise<void> {
  const drawer = page.locator(".conductor__drawer");
  const scenePreview = page.locator(".conductor__stage-mount canvas");
  assert.equal(await scenePreview.isVisible(), true);
  assert.equal(
    await drawer.locator(".conductor__stream-button").count(),
    1,
    "Headset picture controls belong to technician tools",
  );
  const toggle = page.getByRole("button", {
    name: "Technician tools",
    exact: true,
  });
  const close = page.getByRole("button", {
    name: "Close technician tools",
    exact: true,
  });
  assert.equal(
    await drawer.evaluate((element) => element.matches("dialog[open]")),
    false,
  );
  await drawer
    .locator("button")
    .first()
    .evaluate((element) => element.focus());
  assert.equal(
    await drawer.evaluate((element) =>
      element.contains(document.activeElement),
    ),
    false,
    "Closed drawer cannot take focus",
  );
  await toggle.press("Space");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    await close.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(
    await drawer.evaluate((element) => element.matches(":modal")),
    true,
  );
  await checkConductorTargets(page);
  const transport = page.locator(".conductor__transport-button");
  await transport.evaluate((element) => element.focus());
  assert.equal(
    await transport.evaluate((element) => element === document.activeElement),
    false,
    "The modal prevents focus on covered transport controls",
  );
  const drawerControls = drawer.locator("button:enabled, input:enabled");
  for (const [control, key] of [
    [drawerControls.first(), "Shift+Tab"],
    [drawerControls.last(), "Tab"],
  ] as const) {
    await control.focus();
    await page.keyboard.press(key);
    assert.equal(
      await drawer.evaluate(
        (element) =>
          element.contains(document.activeElement) ||
          document.activeElement === document.body,
      ),
      true,
      "Tab boundaries never focus covered main controls",
    );
  }
  await close.focus();
  const heldTime = await observeConductorTime(page);
  const heldLanguage = await page
    .locator('.conductor__language [aria-pressed="true"]')
    .innerText();
  for (const key of ["Home", "ArrowRight", "Digit3", "KeyL", "KeyR"]) {
    await close.press(key);
  }
  assert.equal(await observeConductorTime(page), heldTime);
  assert.equal(
    await page
      .locator('.conductor__language [aria-pressed="true"]')
      .innerText(),
    heldLanguage,
    "Technician tools do not invoke global language shortcuts",
  );
  for (const scale of [0.5, 1]) {
    await drawer.locator(`[data-time-scale="${scale}"]`).click();
    await page.waitForFunction(
      (scale) =>
        document
          .querySelector(`[data-time-scale="${scale}"]`)
          ?.getAttribute("aria-pressed") === "true",
      scale,
    );
  }
  const mainStartSeconds = await readConductorMainStart(page);
  await drawer.locator("[data-reset-show]").click();
  await observeConductorTime(page, mainStartSeconds);
  assert.equal(await transport.getAttribute("data-playing"), "false");
  await drawer.locator("[data-reset-flight]").click();
  await observeConductorTime(page, mainStartSeconds);
  const reload = drawer.locator(".conductor__reload-button");
  const reloadLabel = await reload.innerText();
  await reload.click();
  assert.equal(await reload.getAttribute("data-armed"), "true");
  await page.waitForFunction(
    () =>
      document
        .querySelector(".conductor__reload-button")
        ?.getAttribute("data-armed") === "false",
  );
  assert.equal(await reload.innerText(), reloadLabel);
  assert.equal(
    await drawer.evaluate((element) => element.matches(":modal")),
    true,
  );
  const preview = page.locator(".conductor__m5-preview");
  assert.equal(
    await preview.evaluate((element) => getComputedStyle(element).display),
    "none",
    "Empty M5 host really hides its preview",
  );
  const hostInput = page.getByRole("textbox", { name: "M5 host" });
  await hostInput.fill("");
  await hostInput.pressSequentially("wasd.local");
  await hostInput.press("ArrowLeft");
  await hostInput.press("Backspace");
  assert.equal(
    await hostInput.inputValue(),
    "wasd.locl",
    "Unlocked desktop controls preserve text entry and cursor navigation",
  );
  await hostInput.fill("");
  let sequence = 0;
  let pitch = 0;
  let roll = 0;
  let quality = 1;
  await page.route("http://m5.test/state", (request) =>
    request.fulfill({
      headers: { "access-control-allow-origin": "*" },
      json: {
        deviceId: "browser-smoke-m5",
        firmwareVersion: M5_FIRMWARE_VERSION,
        seq: ++sequence,
        uptimeMs: sequence * 167,
        pitch,
        roll,
        quality,
        buttonPressed: false,
        buttonPressCount: 0,
        buttonReleaseCount: 0,
        isCalibrated: true,
        rssi: -50,
      },
    }),
  );
  await page.getByLabel("M5 host", { exact: true }).fill("http://m5.test");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await page.locator('.conductor__m5-preview[data-live="true"]').waitFor();
  assert.equal(
    await page.locator(".conductor__m5-dot").getAttribute("cx"),
    "50",
  );
  assert.equal(
    await page.locator(".conductor__m5-dot").getAttribute("cy"),
    "50",
  );
  pitch = 0.25;
  roll = -0.5;
  await page.waitForFunction(
    () =>
      document.querySelector(".conductor__m5-dot")?.getAttribute("cx") === "29",
  );
  assert.equal(
    await page.locator(".conductor__m5-dot").getAttribute("cy"),
    "39.5",
  );
  pitch = -0.5;
  roll = 0.25;
  await page.waitForFunction(
    () =>
      document.querySelector(".conductor__m5-dot")?.getAttribute("cx") ===
      "60.5",
  );
  assert.equal(
    await page.locator(".conductor__m5-dot").getAttribute("cy"),
    "71",
  );
  quality = 0;
  await page
    .locator(".conductor__m5-readout")
    .filter({ hasText: /sample q0\.0 · input q1\.0/ })
    .waitFor();
  // Parsed configured-host input remains accepted even when reported quality is zero.
  assert.equal(
    await page.locator('[data-tile="controller"] output').innerText(),
    "OK",
  );
  assertRefactorBranch();
  await page.screenshot({
    path: join(outputDirectory, "conductor-technician.png"),
    fullPage: false,
    caret: "initial",
  });
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  assert.equal(await preview.isVisible(), false);
  await close.press("Escape");
  assert.equal(
    await drawer.evaluate((element) => element.matches("dialog[open]")),
    false,
  );
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    await toggle.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "Closing technician tools keeps the renderer mounted",
  );
  assert.equal(await scenePreview.isVisible(), true);
  await toggle.click();
  assert.equal(
    await drawer.evaluate((element) => element.matches(":modal")),
    true,
  );
  await close.click();
  assert.equal(await drawer.isVisible(), false);
  assert.equal(
    await toggle.evaluate((element) => element === document.activeElement),
    true,
  );
}

async function checkFlash(page: Page): Promise<void> {
  await page
    .getByRole("heading", { name: "M5 Controller — Flash & Setup" })
    .waitFor();
  await page.waitForFunction(
    () => customElements.get("esp-web-install-button") !== undefined,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Send configuration", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await page.locator("[data-command]:enabled").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Connect console", exact: true })
      .count(),
    1,
  );

  const storageKey = "bm-m5-flash-setup";
  const station = { ssid: "smoke-wifi", deviceId: "smoke-m5" };
  const password = "synthetic-smoke-password";
  for (const [legacy, expected] of [
    [JSON.stringify({ ...station, password, obsolete: password }), station],
    [`{"password":"${password}"`, null],
  ] as const) {
    await page.evaluate(
      ({ storageKey, legacy }) => localStorage.setItem(storageKey, legacy),
      { storageKey, legacy },
    );
    await page.reload({ waitUntil: "load" });
    assert.equal(await page.locator('[name="password"]').inputValue(), "");
    assert.equal(
      await page.locator('[name="ssid"]').inputValue(),
      expected?.ssid ?? "",
    );
    assert.equal(
      await page.locator('[name="deviceId"]').inputValue(),
      expected?.deviceId ?? "",
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      expected ? JSON.stringify(expected) : null,
    );
  }

  const serialWrites = await page.evaluateHandle(() => {
    const writes: string[] = [];
    Object.defineProperty(navigator, "serial", {
      value: {
        requestPort: async () => ({
          open: () => Promise.resolve(),
          close: () => Promise.resolve(),
          readable: new ReadableStream<Uint8Array>(),
          writable: new WritableStream<Uint8Array>({
            write(chunk) {
              writes.push(new TextDecoder().decode(chunk));
            },
          }),
        }),
      },
    });
    return writes;
  });
  await page
    .getByRole("button", { name: "Connect console", exact: true })
    .click();
  await page.locator('[name="ssid"]').fill(station.ssid);
  await page.locator('[name="deviceId"]').fill(station.deviceId);
  await page.locator('[name="password"]').fill(password);
  await page
    .getByRole("button", { name: "Send configuration", exact: true })
    .click();
  await page.waitForFunction((writes) => writes.length === 1, serialWrites);
  assert.deepEqual(await serialWrites.jsonValue(), [
    `${JSON.stringify({ type: "configure", ssid: station.ssid, password, deviceId: station.deviceId })}\n`,
  ]);
  const log = await page.locator(".flash__log").innerText();
  assert(log.includes("configure sent; awaiting device response"));
  assert.equal(log.includes("Configuration applied"), false);
  assert.equal(log.includes(password), false);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    JSON.stringify(station),
  );
  await serialWrites.dispose();
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.locator('[name="password"]').inputValue(), "");
  assert.equal(await page.locator('[name="ssid"]').inputValue(), station.ssid);
  assert.equal(
    await page.locator('[name="deviceId"]').inputValue(),
    station.deviceId,
  );
}
