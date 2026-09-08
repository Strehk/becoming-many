/** Exercise steering practice through the real M5 polling and visible guide. */
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { M5_FIRMWARE_VERSION } from "../../src/m5/protocol";
import { assertRefactorBranch } from "./browser-evidence";

const OBSERVATION_MILLISECONDS = 1_400;
const NEUTRAL_SETTLE_MILLISECONDS = 900;
const GUIDE_TIMEOUT_MILLISECONDS = 6_000;
const DEFLECTION = 0.65;

export interface StartSimulation {
  /** Change the next firmware-shaped response; zero quality is invalid input. */
  readonly set: (pitch: number, roll: number, quality?: number) => void;
}

/** Install before navigation so the actual Run receives a configured M5 source. */
export async function prepareStartInput(
  page: Page,
  baseUrl: string,
): Promise<StartSimulation> {
  let pitch = 0;
  let roll = 0;
  let quality = 0;
  let sequence = 0;
  await page.route(`${baseUrl}/config`, (request) =>
    request.fulfill({
      json: {
        m5DeviceId: "browser-smoke-m5",
        m5Host: "http://m5.test",
      },
    }),
  );
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
  return {
    set: (nextPitch, nextRoll, nextQuality = 1): void => {
      pitch = nextPitch;
      roll = nextRoll;
      quality = nextQuality;
    },
  };
}

type Direction = "right" | "left" | "up" | "down";
interface GuidePixels {
  readonly waiting: number;
  readonly confirmed: number;
  readonly direction: Direction;
}

/** Check success, rejected gestures, visible completion, and a fresh page lifetime. */
export async function checkStartLevel(
  page: Page,
  simulation: StartSimulation,
  artifactBase: string,
): Promise<void> {
  const arrival = await expectGuide("arrival", (guide) => guide.waiting > 100);
  await page.waitForTimeout(OBSERVATION_MILLISECONDS);
  await expectGuide("arrival-without-input", isArrival);
  simulation.set(0, -DEFLECTION, 0);
  await page.waitForTimeout(OBSERVATION_MILLISECONDS);
  await expectGuide("arrival-invalid-input", isArrival);

  await neutral();
  await expectGuide(
    "right",
    (guide) =>
      guide.direction === "right" && guide.waiting > arrival.waiting * 2,
  );
  simulation.set(0, DEFLECTION);
  await page.waitForTimeout(OBSERVATION_MILLISECONDS);
  await expectDirection("right-wrong-direction", "right");

  await neutral();
  simulation.set(0, -DEFLECTION);
  await expectDirection("left", "left");

  // Invalid zero input must not arm the next direction like real neutral does.
  simulation.set(0, 0, 0);
  await page.waitForTimeout(NEUTRAL_SETTLE_MILLISECONDS);
  simulation.set(0, DEFLECTION);
  await page.waitForTimeout(OBSERVATION_MILLISECONDS);
  await expectDirection("left-without-valid-neutral", "left");

  await neutral();
  simulation.set(-DEFLECTION, DEFLECTION);
  await expectDirection("up", "up");
  await page.waitForTimeout(OBSERVATION_MILLISECONDS);
  await expectDirection("up-held-diagonal", "up");

  await neutral();
  simulation.set(-DEFLECTION, 0);
  await expectDirection("down", "down");
  await neutral();
  simulation.set(DEFLECTION, 0);
  await expectGuide("complete", isComplete);
  simulation.set(0, 0, 0);
  await page.waitForTimeout(OBSERVATION_MILLISECONDS);
  await expectGuide("complete-stable", isComplete);

  await page.reload({ waitUntil: "load" });
  await expectGuide("arrival-after-reload", isArrival);
  await neutral();
  await expectGuide(
    "right-after-reload",
    (guide) =>
      guide.direction === "right" && guide.waiting > arrival.waiting * 2,
  );

  async function neutral(): Promise<void> {
    // Every gesture passes through zero, staying below M5's abrupt-step limit.
    simulation.set(0, 0);
    await page.waitForTimeout(NEUTRAL_SETTLE_MILLISECONDS);
  }

  function isArrival(guide: GuidePixels): boolean {
    return (
      guide.confirmed === 0 &&
      guide.direction === "right" &&
      guide.waiting > arrival.waiting * 0.8 &&
      guide.waiting < arrival.waiting * 1.2
    );
  }

  function isComplete(guide: GuidePixels): boolean {
    return guide.confirmed > 100 && guide.waiting === 0;
  }

  async function expectDirection(name: string, direction: Direction) {
    return expectGuide(
      name,
      (guide) => guide.direction === direction && guide.waiting > 100,
    );
  }

  async function expectGuide(
    name: string,
    matches: (guide: GuidePixels) => boolean,
  ): Promise<GuidePixels> {
    const deadline = Date.now() + GUIDE_TIMEOUT_MILLISECONDS;
    let observed: GuidePixels | undefined;
    do {
      const screenshot = await page.locator("canvas").first().screenshot();
      observed = await readGuidePixels(page, screenshot.toString("base64"));
      if (matches(observed)) {
        assertRefactorBranch();
        await page.screenshot({ path: `${artifactBase}-start-${name}.png` });
        return observed;
      }
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    assert.fail(
      `Start ${name}: unexpected visible guide ${JSON.stringify(observed)}`,
    );
  }
}

/** Inspect a screenshot, never the application's scene or WebGL drawing buffer. */
async function readGuidePixels(page: Page, png: string): Promise<GuidePixels> {
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Screenshot inspection needs a 2D context");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const columns = new Uint32Array(image.width);
    const rows = new Uint32Array(image.height);
    let waiting = 0;
    let confirmed = 0;
    let minX = image.width;
    let maxX = 0;
    let minY = image.height;
    let maxY = 0;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const index = (y * image.width + x) * 4;
        const red = pixels[index] ?? 0;
        const green = pixels[index + 1] ?? 0;
        const blue = pixels[index + 2] ?? 0;
        if (green > red + 30 && green > blue + 10) confirmed += 1;
        if (!(blue > red + 20 && green > red + 10 && blue > green + 5))
          continue;
        waiting += 1;
        columns[x] = (columns[x] ?? 0) + 1;
        rows[y] = (rows[y] ?? 0) + 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    // The arrowhead is wider than its shaft in the pointing half of the mask.
    const horizontal = maxX - minX > maxY - minY;
    const counts = horizontal ? columns : rows;
    const start = horizontal ? minX : minY;
    const end = horizontal ? maxX : maxY;
    const middle = (start + end) / 2;
    let firstHalf = 0;
    let secondHalf = 0;
    for (let index = start; index <= end; index += 1) {
      if (index < middle) firstHalf = Math.max(firstHalf, counts[index] ?? 0);
      else secondHalf = Math.max(secondHalf, counts[index] ?? 0);
    }
    const direction: "right" | "left" | "up" | "down" = horizontal
      ? secondHalf > firstHalf
        ? "right"
        : "left"
      : firstHalf > secondHalf
        ? "up"
        : "down";
    return { waiting, confirmed, direction };
  }, png);
}
