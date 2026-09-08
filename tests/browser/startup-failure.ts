import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { assertRefactorBranch } from "./browser-evidence";

const STARTUP_TIMEOUT_MILLISECONDS = 30_000;

/** Denied WebGL must expose the declared startup alert and preserve its canvas. */
export async function checkStartupFailure(
  browser: Browser,
  baseUrl: string,
  route: string,
  artifactPath: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  try {
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value(this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (contextId !== "webgl2")
            return Reflect.apply(getContext, this, [contextId, ...args]);
          // Mark the borrowed elements before startup fails so replacement
          // with newly generated markup cannot satisfy the assertions below.
          this.dataset.failureOriginalCanvas = "true";
          const alert = document.querySelector<HTMLElement>(
            "[data-startup-error]",
          );
          if (alert) alert.dataset.failureOriginalAlert = "true";
          return null;
        },
      });
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const expectedError = page.waitForEvent("pageerror", {
      predicate: (error) => /WebGL2 context/.test(error.message),
      timeout: STARTUP_TIMEOUT_MILLISECONDS,
    });
    await Promise.all([
      expectedError,
      page.goto(new URL(route, baseUrl).href, { waitUntil: "load" }),
    ]);
    const alert = page.locator("[data-startup-error]");
    await alert.waitFor({
      state: "visible",
      timeout: STARTUP_TIMEOUT_MILLISECONDS,
    });
    assert.equal(await page.locator('[role="alert"]').count(), 1);
    assert.equal(await alert.count(), 1);
    assert.match(await alert.innerText(), /Unable to start\b/);
    assert.equal(await alert.getAttribute("role"), "alert");
    assert.equal(
      await alert.getAttribute("data-failure-original-alert"),
      "true",
      "The original declared alert must survive failed startup",
    );
    assert.equal(await page.locator("canvas").count(), 1);
    assert.equal(
      await page
        .locator("canvas.experience-canvas")
        .getAttribute("data-failure-original-canvas"),
      "true",
      "The borrowed declared canvas must survive failed startup",
    );
    assert.equal(pageErrors.length, 1, pageErrors.join("\n"));
    assert.match(pageErrors[0] ?? "", /WebGL2 context/);
    assertRefactorBranch();
    await page.screenshot({
      path: artifactPath,
      fullPage: true,
      caret: "initial",
    });
  } finally {
    await context.close();
  }
}
