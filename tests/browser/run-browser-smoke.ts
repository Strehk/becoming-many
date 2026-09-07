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
import { formatShowTime } from "../../src/conductor/time-format";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import { LEVEL_NAMES } from "../../src/levels/level-names";
import {
  assertRefactorBranch,
  collectBrowserErrors,
  readRenderingInfo,
  readRunIdentity,
} from "./browser-evidence";

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
    const routes = [
      "/",
      "/test.html",
      "/test.html?level=echo",
      "/conductor.html",
      "/flash.html",
      ...LEVEL_NAMES.map((level) => `/${level}`),
    ];
    for (const [index, route] of routes.entries()) {
      const result = await runSmokeRoute(browser, route, index);
      results.push(result);
      console.log(
        `${result.passed ? "PASS" : "FAIL"} ${route}: ${result.errors.join("; ")}`,
      );
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
    await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
    assert.equal(
      page.url(),
      `${baseUrl}${route}`,
      "Entry URL must remain the requested route",
    );
    observation = await checkEntry(page, route);
    if (route === "/conductor.html") {
      await page.evaluate(() =>
        window.dispatchEvent(
          new PageTransitionEvent("pagehide", { persisted: true }),
        ),
      );
      assert.equal(
        await page.locator("canvas").count(),
        1,
        "A persisted page keeps its Run",
      );
      await page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent("pagehide")),
      );
      await page.locator(".conductor__masthead").waitFor({ state: "detached" });
      assert.equal(
        await page.locator("canvas").count(),
        0,
        "Page exit removes UI and its Run canvas",
      );
    }
    assert.equal(errors.length, 0, errors.join("\n"));
  } catch (error) {
    errors.push(String(error));
    assertRefactorBranch();
    await page
      .screenshot({ path: `${artifactBase}-failure.png`, fullPage: true })
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
): Promise<EntryObservation> {
  if (route === "/flash.html") {
    await checkFlash(page);
    return {};
  }
  if (route === "/conductor.html") {
    return {
      conductorWakeRequired: await checkConductor(page),
      rendering: await readRenderingInfo(page),
    };
  }
  await waitForLevel(page);
  if (route === "/") await checkRehearsal(page);
  else
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
  await page.waitForFunction(() => window.show?.sample().isPlaying === false);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .locator('button[aria-pressed="true"]')
    .filter({ hasText: /^EN$/ })
    .waitFor();
  await page.getByRole("button", { name: "Echo", exact: true }).click();
  await page.waitForFunction(
    (seconds) => window.show?.sample().timeSeconds === seconds,
    ECHO_START_SECONDS,
  );
  await page.getByRole("button", { name: "Prologue", exact: true }).click();
  await page.waitForFunction(() => window.show?.sample().timeSeconds === 0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () => (window.show?.sample().timeSeconds ?? 0) > 0.2,
  );
  await checkScrubbing(
    page,
    ".rehearsal__track",
    ".rehearsal button:first-child",
    ".rehearsal output",
  );
}

async function checkConductor(page: Page): Promise<boolean> {
  await page.locator(".conductor__wake").waitFor({ state: "attached" });
  const wakeRequired = await page.locator(".conductor__wake").isVisible();
  if (wakeRequired) await page.locator(".conductor__wake").click();
  await page.locator(".conductor__wake").waitFor({ state: "hidden" });
  await checkConductorTransport(page);
  await checkConductorNextVisitor(page);
  await checkScrubbing(
    page,
    ".timeline__track",
    ".conductor__transport-button",
    ".conductor__clock output",
  );
  return wakeRequired;
}

async function checkConductorTransport(page: Page): Promise<void> {
  const transport = page.locator(".conductor__transport-button");
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".conductor__clock output")?.textContent !==
      "0:00",
  );
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="false"]')
    .waitFor();
  const pausedTime = await page
    .locator(".conductor__clock output")
    .textContent();
  await page.waitForTimeout(PAUSE_OBSERVATION_MILLISECONDS);
  assert.equal(
    await page.locator(".conductor__clock output").textContent(),
    pausedTime,
  );
}

async function checkConductorNextVisitor(page: Page): Promise<void> {
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
  await page.waitForFunction(
    (expectedTime) =>
      document.querySelector(".conductor__clock output")?.textContent ===
      expectedTime,
    formatShowTime(ECHO_START_SECONDS),
  );
  await page.getByRole("button", { name: "New visitor", exact: true }).click();
  await page
    .getByRole("button", { name: "Tap again to reset", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".conductor__clock output")?.textContent ===
      "0:00",
  );
  assert.equal(await transport.getAttribute("data-playing"), "false");
  await transport.click();
  await page
    .locator('.conductor__transport-button[data-playing="true"]')
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".conductor__clock output")?.textContent !==
      "0:00",
  );
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "A second visitor must not add a renderer",
  );
}

/** Real pointer capture must restore playing/held state on release and cancel. */
async function checkScrubbing(
  page: Page,
  trackSelector: string,
  transportSelector: string,
  readoutSelector: string,
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
    const bounds = await track.boundingBox();
    assert(bounds, "Timeline must have usable geometry");
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(bounds.x + bounds.width * 0.1, y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.2, y, { steps: 3 });
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
    assert.match(
      await page.locator(readoutSelector).innerText(),
      /^1:4[0-9]/,
      "Drag seeks to the selected show position",
    );
  }
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
  assert(log.includes("[redacted]"));
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
