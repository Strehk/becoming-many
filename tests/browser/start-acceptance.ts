/** Exercise the standalone particle tutorial through real shared M5 locomotion. */
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { FLIGHT_SETTINGS } from "../../src/control/flight-settings";
import { level as START_LEVEL } from "../../src/levels/start.level";
import { M5_FIRMWARE_VERSION } from "../../src/m5/protocol";
import { M5_SETTINGS } from "../../src/m5/runtime/m5-settings";
import { assertRefactorBranch } from "./browser-evidence";

const FORMATION_MILLISECONDS = 26_000;
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
    let visiblePixels = 0;
    do {
      const screenshot = await canvas.screenshot();
      const pixels = await inspectVisibleParticles(
        page,
        screenshot.toString("base64"),
      );
      visiblePixels = pixels.visiblePixels;
      if (visiblePixels > 100) {
        if (name.startsWith("formed-goal")) {
          assert(
            pixels.trainingPixels > 100,
            "The formed target must be visible",
          );
          assert.equal(
            pixels.trainingTouchesEdge,
            false,
            "The formed target must fit inside the viewport",
          );
        }
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
      `Start ${name}: expected visible particles, found ${visiblePixels}`,
    );
  }
}

/** Inspect screenshots without reading application state or the WebGL buffer. */
async function inspectVisibleParticles(
  page: Page,
  png: string,
): Promise<{
  visiblePixels: number;
  trainingPixels: number;
  trainingTouchesEdge: boolean;
}> {
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
    let trainingPixels = 0;
    let trainingTouchesEdge = false;
    // Dense neutral cloud bodies occupy neighboring pixels; sparse Air grains do not.
    const tileSize = 16;
    const columns = Math.ceil(image.width / tileSize);
    const rows = Math.ceil(image.height / tileSize);
    const density = new Uint16Array(columns * rows);
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum >= 245 || minimum < 120 || maximum - minimum > 20) continue;
      visiblePixels += 1;
      const x = (index / 4) % image.width;
      const y = Math.floor(index / 4 / image.width);
      const tile =
        Math.floor(y / tileSize) * columns + Math.floor(x / tileSize);
      density[tile] = (density[tile] ?? 0) + 1;
    }
    for (let tile = 0; tile < density.length; tile += 1) {
      const count = density[tile] ?? 0;
      if (count < 48) continue;
      trainingPixels += count;
      const column = tile % columns;
      const row = Math.floor(tile / columns);
      if (
        column === 0 ||
        row === 0 ||
        column === columns - 1 ||
        row === rows - 1
      )
        trainingTouchesEdge = true;
    }
    return { visiblePixels, trainingPixels, trainingTouchesEdge };
  }, png);
}

/**
 * Fly the generated course through the real M5 adapter and its public handoff.
 * The sensor fixture estimates its own travel toward the public goal observation;
 * only rendered tutorial status establishes passage. No private state is changed.
 */
export async function flyStartCourse(
  page: Page,
  simulation: StartSimulation,
): Promise<void> {
  const status = page.locator("[data-tutorial-status]");
  await status.waitFor({ state: "visible" });
  const originalLanguage = await page.evaluate(() =>
    window.show?.readLanguage(),
  );
  await page.getByRole("button", { name: "DE", exact: true }).click();
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
  const deadline = Date.now() + 65_000;
  while (Date.now() < deadline) {
    assert(
      await status.isVisible(),
      "Success path must finish all goals before timeout",
    );
    const text = await status.innerText();
    const tutorial = await page.evaluate(() => window.show?.readTutorial());
    if (tutorial?.crossingCount === 4) break;
    if (text !== lastStatus) {
      console.log(
        `M5 course: ${text}, estimated travel ${JSON.stringify(estimate)}`,
      );
      lastStatus = text;
    }
    const goal = tutorial?.goalTarget;
    assert(goal, `Expected an observed generated course goal: ${text}`);
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
    const dx = goal.x - estimate.x;
    const dz = goal.z - estimate.z;
    const distance = Math.hypot(dx, dz);
    const desiredHeading = Math.atan2(dx, -dz);
    const headingError = Math.atan2(
      Math.sin(desiredHeading - estimate.heading),
      Math.cos(desiredHeading - estimate.heading),
    );
    const passedPlane =
      dx * Math.sin(estimate.heading) - dz * Math.cos(estimate.heading) < 0;
    const holdStraight = tutorial?.phase === "arrival";
    const roll =
      passedPlane || holdStraight ? 0 : -clamp(headingError * 2, -0.5, 0.5);
    const climb =
      passedPlane || holdStraight
        ? 0
        : clamp(((goal.y - estimate.y) * 5) / Math.max(distance, 2), -2.5, 2.5);
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
    /(?:Passed|Complete) · 4\/4/,
    `M5 course did not complete; estimated travel ${JSON.stringify(estimate)}`,
  );
  const closingSeconds = START_LEVEL.startNarration?.de.find(
    (clip) => clip.cueId === "complete",
  )?.durationSeconds;
  assert(closingSeconds);
  // Start publishes the crossing before Show schedules its closing instruction.
  await page.waitForFunction(
    (durationSeconds) => {
      const sample = window.show?.sample();
      return (
        sample !== undefined &&
        sample.mainStartSeconds - sample.timeSeconds >= durationSeconds - 0.5
      );
    },
    closingSeconds,
    { timeout: 1_000 },
  );
  const completion = await page.evaluate(() => ({
    sample: window.show?.sample(),
    tutorial: window.show?.readTutorial(),
  }));
  assert(completion.sample && completion.tutorial);
  assert.equal(completion.tutorial.crossingCount, 4);
  assert.equal(completion.tutorial.missCount ?? 0, 0);
  assert(
    completion.sample.mainStartSeconds - completion.sample.timeSeconds >=
      closingSeconds - 0.5,
    "Successful passage reserves the full German closing instruction",
  );
  const closingStartedAt = performance.now();
  await status.waitFor({ state: "hidden", timeout: 20_000 });
  assert(
    (performance.now() - closingStartedAt) / 1000 >= closingSeconds - 0.5,
    "Automatic handoff must wait for the closing instruction without a button click",
  );
  const main = await page.evaluate(() => window.show?.sample());
  assert(main?.isPlaying);
  assert(
    main.mainStartSeconds >= completion.sample.mainStartSeconds + 1.4,
    "The actual timeline includes breathing space after the full voice",
  );
  if (originalLanguage && originalLanguage !== "de")
    await page
      .getByRole("button", {
        name: originalLanguage.toUpperCase(),
        exact: true,
      })
      .click();

  function integrate(input: InputDelivery, deltaSeconds: number): void {
    const yaw =
      -input.roll * FLIGHT_SETTINGS.yawRateRadiansPerSecond * deltaSeconds;
    const distance =
      (START_LEVEL.flightSpeedMetersPerSecond ??
        FLIGHT_SETTINGS.glideSpeedMetersPerSecond) * deltaSeconds;
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

/** Stop learning at one minute, finish the current voice, then leave breathing space. */
export async function checkStartTimeout(
  page: Page,
  simulation: StartSimulation,
): Promise<void> {
  const status = page.locator("[data-tutorial-status]");
  await status.waitFor({ state: "visible" });
  simulation.set(-0.1, 0);
  const transport = page.locator(
    "[data-transport], .conductor__transport-button",
  );
  if ((await transport.innerText()).trim() === "Play") await transport.click();
  const deadline = Date.now() + 70_000;
  let misses = 0;
  let crossings = 0;
  let lastTutorialSeconds = 0;
  while (Date.now() < deadline) {
    const observation = await page.evaluate(() => ({
      tutorial: window.show?.readTutorial(),
      sample: window.show?.sample(),
    }));
    if (!observation.tutorial) break;
    misses = Math.max(misses, observation.tutorial.missCount ?? 0);
    crossings = Math.max(crossings, observation.tutorial.crossingCount);
    lastTutorialSeconds = observation.sample?.timeSeconds ?? 0;
    assert(crossings < 4, "Timeout fixture must not complete the course");
    assert.notEqual(observation.tutorial.phase, "complete");
    await page.waitForTimeout(100);
  }
  simulation.set(0, 0, 0);
  assert(misses >= 1, "Timeout fixture must observe an actual missed goal");
  assert(
    lastTutorialSeconds >= 59.5,
    "Timeout must retain the full practice minute",
  );
  assert.equal(await status.isVisible(), false);
  const sample = await page.evaluate(() => window.show?.sample());
  assert(sample?.isPlaying);
  assert(
    sample.mainStartSeconds >= 61.4 && sample.mainStartSeconds < 70,
    "Timeout retains breathing space and the current instruction without a success outro",
  );
}
