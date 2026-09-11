/**
 * Exercise Conductor picture intent, browser rejection, recovery and cleanup.
 * The real UI runs against a simulated XR contract; this does not validate PCVR.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertRefactorBranch, collectBrowserErrors } from "./browser-evidence";

assertRefactorBranch();
const browser = await chromium.launch({
  headless: true,
  args:
    process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu"] : [],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = collectBrowserErrors(page);
try {
  await page.addInitScript(() => {
    const observers = new Set();
    let state = { availability: "available", isSessionActive: false };
    window.headsetProbe = {
      starts: 0,
      stops: 0,
      failure: "SecurityError",
      subscribe(observer) {
        observers.add(observer);
        observer(state);
        return () => observers.delete(observer);
      },
      set(next) {
        state = { ...state, ...next };
        for (const observer of observers) observer(state);
      },
      async start() {
        this.starts++;
        if (this.failure)
          throw new DOMException("Simulated rejection", this.failure);
        this.set({ isSessionActive: true });
      },
      async stop() {
        this.stops++;
        this.set({ isSessionActive: false });
      },
    };
  });
  await page.route("**/entry/conductor.entry.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes("xr: run.xr,"));
    await route.fulfill({
      response,
      body: source.replace("xr: run.xr,", "xr: window.headsetProbe,"),
    });
  });
  await page.goto(
    `${process.argv[2] ?? "http://127.0.0.1:4180"}/conductor.html`,
  );
  const button = page.locator(".conductor__masthead .conductor__stream-button");
  await button
    .getByText("Picture: click to retry", { exact: true })
    .waitFor({ timeout: 120000 });
  await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(() => window.headsetProbe.starts), 1);

  await page.evaluate(() => {
    window.headsetProbe.failure = "";
  });
  await button.click();
  await button.getByText("Picture On", { exact: true }).waitFor();
  assert.equal(await button.getAttribute("aria-pressed"), "true");
  await page.evaluate(() =>
    window.headsetProbe.set({ isSessionActive: false }),
  );
  await page.waitForFunction(() => window.headsetProbe.starts === 3);
  await button.getByText("Picture On", { exact: true }).waitFor();

  await button.click();
  await button.getByText("Picture Off", { exact: true }).waitFor();
  await page.locator(".conductor__stop-button").click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.headsetProbe.starts), 3);
  assert.equal(await page.evaluate(() => window.headsetProbe.stops), 1);

  await page.evaluate(() => {
    window.headsetProbe.failure = "NetworkError";
  });
  await button.click();
  await page.waitForFunction(() => window.headsetProbe.starts === 4);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.headsetProbe.starts), 4);
  await page.evaluate(() => {
    window.headsetProbe.failure = "";
  });
  await page.waitForFunction(() => window.headsetProbe.starts === 5);
  await button.getByText("Picture On", { exact: true }).waitFor();

  await page.evaluate(() =>
    window.headsetProbe.set({
      availability: "unsupported",
      isSessionActive: false,
    }),
  );
  await button.getByText("Picture unavailable", { exact: true }).waitFor();
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() =>
    window.headsetProbe.set({ availability: "available" }),
  );
  await page.waitForFunction(() => window.headsetProbe.starts === 6);
  await button.getByText("Picture On", { exact: true }).waitFor();

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    window.headsetProbe.set({ isSessionActive: false });
  });
  await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(() => window.headsetProbe.starts), 6);
  // Stop and pagehide intentionally cancel the tutorial owner's pending audio.
  const failures = errors.filter(
    (error) =>
      !/^request: .*\/audio\/tutorial\/.*: net::ERR_ABORTED$/.test(error),
  );
  assert.deepEqual(failures, []);
  console.log(
    "Conductor XR simulation passed: activation, recovery, explicit off, retry spacing, reconnect and cleanup.",
  );
} catch (error) {
  console.error({
    errors,
    state: await page.evaluate(() => ({
      starts: window.headsetProbe?.starts,
      text: document.querySelector(".conductor__stream-button")?.textContent,
      inert: document.querySelector(".conductor")?.inert,
    })),
  });
  throw error;
} finally {
  await browser.close();
}
