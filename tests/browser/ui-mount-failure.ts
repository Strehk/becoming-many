import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { assertRefactorBranch } from "./browser-evidence";

const STARTUP_TIMEOUT_MILLISECONDS = 90_000;

/** Break one real UI declaration; partial mounting must leave no controls or Run. */
export async function checkUiMountFailure(
  browser: Browser,
  baseUrl: string,
  route: string,
  artifactPath: string,
): Promise<void> {
  assert(["/", "/conductor.html", "/flash.html"].includes(route));
  const isFlash = route === "/flash.html";
  const isRehearsal = route === "/";
  const expectedMessage = isFlash
    ? "Missing HTMLElement: [data-role='firmware-version']"
    : isRehearsal
      ? "Missing SVGLineElement: line"
      : "Missing HTMLButtonElement: button";
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  context.setDefaultTimeout(STARTUP_TIMEOUT_MILLISECONDS);
  try {
    await context.addInitScript((flash) => {
      if (flash) {
        const addListener = EventTarget.prototype.addEventListener;
        Object.defineProperty(EventTarget.prototype, "addEventListener", {
          configurable: true,
          value(this: EventTarget, type: string, ...args: unknown[]) {
            if (
              type === "click" &&
              this instanceof HTMLButtonElement &&
              this.matches("[data-command]")
            )
              this.dataset.failureCommandBound = "true";
            return Reflect.apply(addListener, this, [type, ...args]);
          },
        });
        return;
      }
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value(this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          const gl = Reflect.apply(getContext, this, [contextId, ...args]);
          if (
            contextId === "webgl2" &&
            gl &&
            this.matches(".experience-canvas") &&
            !this.dataset.failureOriginalCanvas
          ) {
            this.dataset.failureOriginalCanvas = "true";
            this.addEventListener(
              "webglcontextlost",
              () => {
                this.dataset.failureContextLost = "true";
              },
              { once: true },
            );
          }
          return gl;
        },
      });
    }, isFlash);
    const page = await context.newPage();
    const url = new URL(route, baseUrl).href;
    await page.route(url, async (request) => {
      const response = await request.fetch();
      const html = await response.text();
      const template = isRehearsal
        ? "data-tick-template"
        : "data-chapter-button";
      const body = isFlash
        ? html.replace(
            /data-role=(?:["']firmware-version["']|firmware-version(?=[\s>]))/,
            "data-missing-firmware-version",
          )
        : html.replace(
            new RegExp(
              `(<template\\b[^>]*\\b${template}[^>]*>)[\\s\\S]*?(</template\\s*>)`,
            ),
            "$1$2",
          );
      assert.notEqual(
        body,
        html,
        "The actual HTML must contain the broken declaration",
      );
      await request.fulfill({ response, body });
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await Promise.all([
      page.waitForEvent("pageerror", {
        predicate: (error) => error.message === expectedMessage,
      }),
      page.goto(url, { waitUntil: "load" }),
    ]);
    if (isFlash) {
      assert.equal(await page.locator("[data-command]").count(), 6);
      assert.equal(
        await page.locator("[data-failure-command-bound]").count(),
        0,
      );
    } else {
      await page.locator("[data-startup-error]").waitFor({ state: "visible" });
      assert.equal(await page.locator("canvas").count(), 1);
      const canvas = page.locator("canvas.experience-canvas");
      assert.equal(
        await canvas.getAttribute("data-failure-original-canvas"),
        "true",
      );
      await page.waitForFunction(() =>
        document
          .querySelector("canvas")
          ?.hasAttribute("data-failure-context-lost"),
      );
      assert.equal(
        await canvas.evaluate(
          (element) =>
            element instanceof HTMLCanvasElement &&
            element.getContext("webgl2")?.isContextLost(),
        ),
        true,
      );
      const chapterSelector = isRehearsal
        ? "[data-sections] button, [data-track] .rehearsal__tick"
        : ".timeline__track .timeline__slot, .conductor__chapters button";
      assert.equal(await page.locator(chapterSelector).count(), 0);
      assert.equal(
        await page
          .locator(isRehearsal ? "[data-playhead]" : ".timeline__playhead")
          .count(),
        1,
      );
    }
    assert.deepEqual(pageErrors, [expectedMessage]);
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
