/** Exercise the standalone particle tutorial through real shared M5 locomotion. */
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { FLIGHT_SETTINGS } from "../../src/control/flight-settings";
import { level as startLevel } from "../../src/levels/start.level";
import { M5_FIRMWARE_VERSION } from "../../src/m5/protocol";
import { M5_SETTINGS } from "../../src/m5/runtime/m5-settings";
import type { StartGoal } from "../../src/modules/start/start.module";
import { assertRefactorBranch } from "./browser-evidence";

const FORMATION_MILLISECONDS = 5_000;
const FLIGHT_MILLISECONDS = 1_500;
const DEFLECTION = 0.4;

export interface StartSimulation {
  /** Change the next firmware-shaped response; zero quality is invalid input. */
  readonly set: (pitch: number, roll: number, quality?: number) => void;
  readonly readDelivery: () => InputDelivery;
}

interface InputDelivery {
  readonly atMilliseconds: number;
  readonly pitch: number;
  readonly roll: number;
  readonly quality: number;
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
  let delivery: InputDelivery = {
    atMilliseconds: performance.now(),
    pitch,
    roll,
    quality,
  };
  await page.route(`${baseUrl}/config`, (request) =>
    request.fulfill({
      json: {
        m5DeviceId: "browser-smoke-m5",
        ...(includeDeploymentHost ? { m5Host: "http://m5.test" } : {}),
      },
    }),
  );
  await page.route("http://m5.test/state", async (request) => {
    const sampled = { atMilliseconds: performance.now(), pitch, roll, quality };
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
    delivery = {
      ...sampled,
      pitch:
        sampled.quality > 0
          ? delivery.pitch +
            (sampled.pitch - delivery.pitch) * M5_SETTINGS.smoothingFactor
          : 0,
      roll:
        sampled.quality > 0
          ? delivery.roll +
            (sampled.roll - delivery.roll) * M5_SETTINGS.smoothingFactor
          : 0,
    };
  });
  return {
    readDelivery: () => delivery,
    set: (nextPitch, nextRoll, nextQuality = 1): void => {
      pitch = nextPitch;
      roll = nextRoll;
      quality = nextQuality;
    },
  };
}

/**
 * Retain visible arrival, formation, shared flight and fresh-lifetime evidence.
 * Spatial passage semantics are covered by the focused Start logic tests; this
 * smoke does not infer learning completion from an input gesture or pixel color.
 */
export async function checkStartLevel(
  page: Page,
  simulation: StartSimulation,
  artifactBase: string,
): Promise<void> {
  const status = page.locator("[data-tutorial-status]");
  await status.waitFor({ state: "visible" });
  await captureParticles("arrival");
  await page.locator("[data-transport]").click();
  await page.waitForTimeout(FORMATION_MILLISECONDS);
  await captureParticles("formed-goal");
  assert.match(await status.innerText(), /Right · 1\/4/);

  // The existing adapter receives invalid movement before real flight is enabled.
  simulation.set(0, -DEFLECTION, 0);
  await page.waitForTimeout(FLIGHT_MILLISECONDS);
  await captureParticles("invalid-input");
  assert.match(await status.innerText(), /Right · 1\/4/);
  simulation.set(-0.1, 0);
  await page.waitForTimeout(FLIGHT_MILLISECONDS);
  await captureParticles("forward-flight");
  simulation.set(-0.1, -DEFLECTION);
  await page.waitForTimeout(FLIGHT_MILLISECONDS);
  await captureParticles("turning-flight");
  simulation.set(-DEFLECTION, 0);
  await page.waitForTimeout(FLIGHT_MILLISECONDS);
  await captureParticles("climbing-flight");

  simulation.set(0, 0, 0);
  await page.reload({ waitUntil: "load" });
  await status.waitFor({ state: "visible" });
  assert.match(await status.innerText(), /Right · 1\/4/);
  await captureParticles("arrival-after-reload");
  await page.locator("[data-transport]").click();
  await page.waitForTimeout(FORMATION_MILLISECONDS);
  await captureParticles("formed-goal-after-reload");

  async function captureParticles(name: string): Promise<void> {
    const canvas = page.locator(".experience-canvas");
    await canvas.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const canvas = document.querySelector(".experience-canvas");
      return canvas instanceof HTMLCanvasElement && canvas.width > 0;
    });
    const deadline = Date.now() + FORMATION_MILLISECONDS;
    let darkPixels = 0;
    do {
      const screenshot = await canvas.screenshot();
      darkPixels = await countVisibleParticles(
        page,
        screenshot.toString("base64"),
      );
      if (darkPixels > 100) {
        assertRefactorBranch();
        await page.screenshot({
          path: `${artifactBase}-start-${name}.png`,
          caret: "initial",
        });
        return;
      }
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    assert.fail(
      `Start ${name}: expected visible particles, found ${darkPixels}`,
    );
  }
}

/** Inspect screenshots without reading application state or the WebGL buffer. */
async function countVisibleParticles(page: Page, png: string): Promise<number> {
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
    let darkPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      if (Math.max(red, green, blue) < 200) darkPixels += 1;
    }
    return darkPixels;
  }, png);
}

/**
 * Fly the authored course through the real M5 adapter, then use its public handoff.
 * The sensor fixture estimates its own travel to steer; only rendered tutorial
 * status establishes passage. No scene, camera or private progress API is read.
 */
export async function flyStartCourse(
  page: Page,
  simulation: StartSimulation,
): Promise<void> {
  const goals = startLevel.start?.goals;
  assert(goals?.length);
  const status = page.locator("[data-tutorial-status]");
  await status.waitFor({ state: "visible" });
  const transport = page.locator(
    "[data-transport], .conductor__transport-button",
  );
  simulation.set(-0.1, 0);
  await page.waitForTimeout(500);
  if ((await transport.innerText()).trim() === "Play") await transport.click();

  const estimate = { x: 0, y: 0, z: 0, heading: 0 };
  let previousDelivery = simulation.readDelivery();
  let previousMilliseconds = performance.now();
  let lastStatus = "";
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const text = await status.innerText();
    if (text.includes("Complete")) break;
    if (text !== lastStatus) {
      console.log(
        `M5 course: ${text}, estimated travel ${JSON.stringify(estimate)}`,
      );
      lastStatus = text;
    }
    const goalNumber = Number(text.match(/(\d)\/4/)?.[1]);
    const goal: StartGoal | undefined = goals[goalNumber - 1];
    assert(goal, `Expected a public course goal: ${text}`);
    const now = performance.now();
    const delivery = simulation.readDelivery();
    if (delivery !== previousDelivery) {
      integrate(
        previousDelivery,
        Math.max(0, delivery.atMilliseconds - previousMilliseconds) / 1000,
      );
      previousMilliseconds = Math.max(
        previousMilliseconds,
        delivery.atMilliseconds,
      );
      previousDelivery = delivery;
    }
    integrate(previousDelivery, (now - previousMilliseconds) / 1000);
    previousMilliseconds = now;
    const [goalX, goalY, goalZ] = goal.offsetMeters;
    const dx = goalX - estimate.x;
    const dz = goalZ - estimate.z;
    const distance = Math.hypot(dx, dz);
    const desiredHeading = Math.atan2(dx, -dz);
    const headingError = Math.atan2(
      Math.sin(desiredHeading - estimate.heading),
      Math.cos(desiredHeading - estimate.heading),
    );
    const passedPlane = estimate.z < goalZ;
    const roll = passedPlane ? 0 : -clamp(headingError * 2, -0.5, 0.5);
    const climb = passedPlane
      ? 0
      : clamp(((goalY - estimate.y) * 5) / Math.max(distance, 2), -2.5, 2.5);
    simulation.set(
      -(climb + FLIGHT_SETTINGS.neutralDescentMetersPerSecond) /
        FLIGHT_SETTINGS.climbRateMetersPerSecond,
      roll,
    );
    await page.waitForTimeout(80);
  }
  simulation.set(0, 0, 0);
  assert.match(
    await status.innerText(),
    /Complete · 4\/4/,
    `M5 course did not complete; estimated travel ${JSON.stringify(estimate)}`,
  );
  const proceed = page.locator("[data-continue-experience]");
  await proceed.waitFor({ state: "visible" });
  assert.equal(await proceed.isEnabled(), true);
  await proceed.click();
  await status.waitFor({ state: "hidden" });

  function integrate(input: InputDelivery, deltaSeconds: number): void {
    const yaw =
      -input.roll * FLIGHT_SETTINGS.yawRateRadiansPerSecond * deltaSeconds;
    const distance = FLIGHT_SETTINGS.glideSpeedMetersPerSecond * deltaSeconds;
    estimate.x += Math.sin(estimate.heading + yaw / 2) * distance;
    estimate.z -= Math.cos(estimate.heading + yaw / 2) * distance;
    estimate.y +=
      (-input.pitch * FLIGHT_SETTINGS.climbRateMetersPerSecond -
        FLIGHT_SETTINGS.neutralDescentMetersPerSecond) *
      deltaSeconds;
    estimate.heading += yaw;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
