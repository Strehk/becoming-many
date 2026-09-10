/** Exercise the standalone air particles through real shared M5 locomotion. */
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { M5_FIRMWARE_VERSION } from "../../src/m5/protocol";
import { assertRefactorBranch } from "./browser-evidence";

const PARTICLE_TIMEOUT_MILLISECONDS = 10_000;
const FLIGHT_MILLISECONDS = 1_500;
const DEFLECTION = 0.4;

export interface StartSimulation {
  /** Change the next firmware-shaped response; zero quality is invalid input. */
  readonly set: (pitch: number, roll: number, quality?: number) => void;
}

/** Install before navigation so the actual Run receives a configured M5 source. */
export async function prepareStartInput(
  page: Page,
  baseUrl: string,
  includeDeploymentHost = true,
): Promise<StartSimulation> {
  let pitch = 0;
  let roll = 0;
  let quality = 0;
  let sequence = 0;
  await page.route(`${baseUrl}/config`, (request) =>
    request.fulfill({
      json: {
        m5DeviceId: "browser-smoke-m5",
        ...(includeDeploymentHost ? { m5Host: "http://m5.test" } : {}),
      },
    }),
  );
  await page.route("http://m5.test/state", async (request) => {
    await request.fulfill({
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
    });
  });
  return {
    set: (nextPitch, nextRoll, nextQuality = 1): void => {
      pitch = nextPitch;
      roll = nextRoll;
      quality = nextQuality;
    },
  };
}

/** Capture free flight, invalid input and a fresh particle lifetime after reload. */
export async function checkStartLevel(
  page: Page,
  simulation: StartSimulation,
  artifactBase: string,
): Promise<void> {
  await captureParticles(page, `${artifactBase}-start-arrival.png`);
  for (const [name, pitch, roll, quality] of [
    ["invalid-input", 0, -DEFLECTION, 0],
    ["forward-flight", -0.1, 0, 1],
    ["turning-flight", -0.1, -DEFLECTION, 1],
    ["climbing-flight", -DEFLECTION, 0, 1],
  ] as const) {
    simulation.set(pitch, roll, quality);
    await page.waitForTimeout(FLIGHT_MILLISECONDS);
    await captureParticles(page, `${artifactBase}-start-${name}.png`);
  }
  simulation.set(0, 0, 0);
  await page.reload({ waitUntil: "load" });
  await captureParticles(page, `${artifactBase}-start-after-reload.png`);
  assert.equal(await page.evaluate(() => window.show), undefined);
  assert.equal(await page.locator("canvas").count(), 1);
}

async function captureParticles(page: Page, path: string): Promise<void> {
  const canvas = page.locator(".experience-canvas");
  await canvas.waitFor({ state: "visible" });
  const deadline = Date.now() + PARTICLE_TIMEOUT_MILLISECONDS;
  let visiblePixels = 0;
  do {
    const screenshot = await canvas.screenshot();
    visiblePixels = await inspectVisibleParticles(
      page,
      screenshot.toString("base64"),
    );
    if (visiblePixels > 100) {
      assertRefactorBranch();
      await page.screenshot({ path, caret: "initial" });
      return;
    }
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  assert.fail(`Start: expected visible air particles, found ${visiblePixels}`);
}

/** Count neutral air grains in screenshots without reading the WebGL buffer. */
async function inspectVisibleParticles(
  page: Page,
  png: string,
): Promise<number> {
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
    let visiblePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum >= 245 || minimum < 120 || maximum - minimum > 20) continue;
      visiblePixels += 1;
    }
    return visiblePixels;
  }, png);
}
