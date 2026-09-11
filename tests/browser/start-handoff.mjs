import assert from "node:assert/strict";
import { chromium } from "playwright";

// Browser-only access to existing owners; production receives no debug commands.
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.route("**/src/levels/level.runtime.ts*", async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    "return run;",
    "window.handoffRun = run; return run;",
  );
  await route.fulfill({ response, body });
});
await page.addInitScript(() => {
  const NativeAudio = window.Audio;
  window.testClips = [];
  window.Audio = class extends NativeAudio {
    constructor() {
      super();
      this.defaultPlaybackRate = 8;
      this.playbackRate = 8;
      window.testClips.push(this);
    }
  };
});
try {
  await page.goto(
    process.argv.includes("--abort")
      ? "http://127.0.0.1:4180/"
      : "http://127.0.0.1:4180/start",
  );
  await page.waitForFunction(() => window.handoffRun?.tutorial, {
    timeout: 120000,
  });
  await page.evaluate(() => {
    const run = window.handoffRun;
    window.originalOwners = {
      renderer: run.world.renderer,
      xr: run.xr,
      context: run.audio.context,
    };
  });
  if (process.argv.includes("--abort")) {
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      ),
    );
    await page.waitForFunction(
      () => window.originalOwners.context.state === "closed",
    );
    assert.equal(
      await page.evaluate(() => window.handoffRun.world.scene.children.length),
      0,
    );
    assert.equal(
      await page.evaluate(() =>
        window.testClips.every((clip) => !clip.getAttribute("src")),
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "Tutorial cancellation: all resources released without starting Show.",
    );
  } else {
    assert.equal(await page.evaluate(() => !!window.show), false);
    for (let index = 0; index < 4; index++) {
      await page.waitForFunction(
        (index) => {
          const start = window.handoffRun.tutorial?.tutorial;
          return (
            start?.game.readState().exerciseIndex === index &&
            start?.game.readState().phase === "flying"
          );
        },
        index,
        { timeout: 40000 },
      );
      await fly("exerciseEndMeters");
      console.log("Completed exercise", index);
      await page.waitForFunction(
        (index) => {
          const state = window.handoffRun.tutorial.tutorial.game.readState();
          return state.phase === (index === 3 ? "closing" : "outro");
        },
        index,
        { timeout: 15000 },
      );
      if (index === 3) {
        await page.waitForFunction(() =>
          window.testClips.some(
            (clip) =>
              clip.src.endsWith("complete.wav") &&
              clip.currentTime > 0.02 &&
              !clip.paused,
          ),
        );
        await page.evaluate(() =>
          window.testClips
            .find((clip) => clip.src.endsWith("complete.wav"))
            .pause(),
        );
      }
      await fly("lengthMeters", true);
    }
    assert.equal(await page.evaluate(() => !!window.handoffRun.tutorial), true);
    assert.equal(await page.evaluate(() => !!window.show), false);
    await page.screenshot({ path: "/tmp/start-handoff-before.png" });
    await page.evaluate(() =>
      window.testClips.find((clip) => clip.src.endsWith("complete.wav")).play(),
    );
    await page.waitForFunction(
      () => !!window.show && !window.handoffRun.tutorial,
      null,
      { timeout: 30000 },
    );
    const result = await page.evaluate(() => {
      const run = window.handoffRun;
      const position = run.world.viewerRig.position;
      return {
        renderer: run.world.renderer === window.originalOwners.renderer,
        xr: run.xr === window.originalOwners.xr,
        context: run.audio.context === window.originalOwners.context,
        fieldOfView: run.world.camera.fov,
        expectedFieldOfView: run.mainFieldOfViewDegrees,
        clearance:
          position.y - run.worldSurface.groundYAt(position.x, position.z),
        distance: Math.hypot(position.x, position.z),
        tutorialObjects: run.world.scene.children.filter((child) =>
          /Start/.test(child.name),
        ).length,
        tutorialAudio: window.testClips.filter((clip) =>
          clip.src.includes("/tutorial/"),
        ).length,
        playing: run.show.sample(),
      };
    });
    assert.equal(result.renderer, true);
    assert.equal(result.xr, true);
    assert.equal(result.context, true);
    assert.ok(result.fieldOfView > 0);
    assert.equal(result.fieldOfView, result.expectedFieldOfView);
    assert.ok(result.clearance > 7 && result.clearance < 9);
    assert.ok(result.distance < 2);
    assert.equal(result.tutorialObjects, 0);
    assert.equal(result.tutorialAudio, 0);
    await page.waitForTimeout(7000);
    await page.screenshot({ path: "/tmp/start-handoff-main.png" });
    console.log("Handoff:", result);
    console.log("Show:", await page.evaluate(() => window.show.sample()));
    await page.evaluate(async () => {
      await window.handoffRun.unload();
      await window.handoffRun.unload();
    });
    assert.equal(
      await page.evaluate(() => window.originalOwners.context.state),
      "closed",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Tutorial → Show: audio gate, placement, shared owners and disposal passed.",
    );
  }
} catch (error) {
  console.log("browser errors", errors);
  console.log(
    "state on failure",
    await page.evaluate(() => ({
      state: window.handoffRun?.tutorial?.tutorial.game.readState(),
      handoff: window.handoffRun?.handoffElapsed,
      voice: window.testClips?.map((a) => ({
        src: a.src,
        time: a.currentTime,
        ended: a.ended,
        paused: a.paused,
      })),
      complete: window.handoffRun?.tutorial?.tutorial.readComplete(),
    })),
  );
  throw error;
} finally {
  await browser.close();
}

async function fly(endKey, fromExercise = false) {
  await page.evaluate(
    async ({ endKey, fromExercise }) => {
      const run = window.handoffRun;
      const start = run.tutorial.tutorial;
      const section = start.current;
      const position = run.world.viewerRig.position;
      const origin = fromExercise ? section.route.exerciseEndMeters : -1;
      for (
        let distance = origin;
        distance <= section.route[endKey] + 0.4;
        distance += 0.3
      ) {
        section.route.sample(distance, position);
        position
          .applyAxisAngle(run.world.scene.up, section.pose.yawRadians)
          .add(section.pose.position);
        const direction = position.clone();
        section.route.sampleDirection(distance, direction);
        direction.applyAxisAngle(run.world.scene.up, section.pose.yawRadians);
        run.world.viewerRig.quaternion.setFromUnitVectors(
          position.clone().set(0, 0, -1),
          direction,
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    },
    { endKey, fromExercise },
  );
}
