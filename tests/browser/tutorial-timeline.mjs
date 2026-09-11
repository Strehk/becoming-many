import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import { timelineChapters } from "../../src/dramaturgy/schedule-layout";
import { assertRefactorBranch, collectBrowserErrors } from "./browser-evidence";

// Dev-server interception exposes existing owners only to this focused harness.
assertRefactorBranch();
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4180";
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const routes =
    process.argv.length > 3
      ? process.argv.slice(3)
      : ["/conductor.html", "/", "/start"];
  for (const path of routes) await verifyRoute(path);
  await verifyCancelledSkip();
} finally {
  await browser.close();
}

async function openRun(path) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = collectBrowserErrors(page);
  await page.route("**/src/levels/level.runtime.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes("return run;"));
    await route.fulfill({
      response,
      body: source.replace(
        "return run;",
        "window.timelineRun = run; return run;",
      ),
    });
  });
  await page.goto(`${baseUrl}${path}`);
  await page.waitForFunction(() => window.timelineRun?.readTutorial(), null, {
    timeout: 120000,
  });
  return { page, errors };
}

async function verifyRoute(path) {
  const { page, errors } = await openRun(path);
  try {
    const conductor = path === "/conductor.html";
    const track = page.locator(conductor ? ".timeline__track" : "[data-track]");
    assert.equal(await track.isVisible(), true);
    const transport = page.locator(
      conductor ? ".conductor__transport-button" : "[data-transport]",
    );
    assert.equal(await transport.isDisabled(), true);
    if (conductor)
      assert.equal(
        await page.locator(".conductor__stop-button").isDisabled(),
        true,
      );
    assert.equal(await page.evaluate(() => !!window.show), false);
    await page.evaluate(() => {
      const run = window.timelineRun;
      window.initialRenderer = run.world.renderer;
      window.showPublications = 0;
      run.subscribeShow((show) => {
        if (show) window.showPublications++;
      });
      run.skipTutorial(Number.NaN);
    });
    assert.equal(
      await page.evaluate(() => window.timelineRun.readTutorial().phase),
      "active",
    );
    await verifyProgressDisplay(page, conductor);
    await page.waitForTimeout(14000);
    await page.screenshot({
      path: conductor
        ? "/tmp/conductor-tutorial-ui.png"
        : path === "/"
          ? "/tmp/web-tutorial-timeline.png"
          : "/tmp/start-tutorial-timeline.png",
    });
    await verifySkipAndTransport(page, track, conductor);
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      ),
    );
    await page.waitForFunction(
      () => window.timelineRun.audio.context.state === "closed",
    );
    assert.equal(await page.evaluate(() => window.show === undefined), true);
    assert.deepEqual(unexpectedErrors(errors), []);
    console.log(`Tutorial timeline ${path}: passed`);
  } finally {
    await page.close();
  }
}

async function verifySkipAndTransport(page, track, conductor) {
  const bounds = await track.boundingBox();
  assert.ok(bounds);
  await page.mouse.click(
    bounds.x + bounds.width * 0.45,
    bounds.y + bounds.height / 2,
  );
  await page.waitForFunction(
    () => window.timelineRun.readTutorial()?.phase === "transition",
  );
  const clickedTarget = await page.evaluate(
    () => window.timelineRun.skipTarget.timeSeconds,
  );
  assert.ok(
    Math.abs(
      clickedTarget - ((0.45 - 0.12) / 0.88) * PIECE_SCHEDULE.durationSeconds,
    ) < 1,
  );
  await page.evaluate(() => window.timelineRun.skipTutorial(180, false));
  await page.waitForFunction(() => !!window.show, null, { timeout: 15000 });
  const handoff = await page.evaluate(() => ({
    time: window.show.sample().timeSeconds,
    playing: window.show.sample().isPlaying,
    publications: window.showPublications,
    renderer: window.initialRenderer === window.timelineRun.world.renderer,
  }));
  assert.ok(Math.abs(handoff.time - 180) < 0.001, JSON.stringify(handoff));
  assert.equal(handoff.playing, false);
  assert.equal(handoff.publications, 1);
  assert.equal(handoff.renderer, true);
  if (conductor) await verifyHeldTimeline(page);
  assert.equal(await track.isVisible(), true);
  const chapters = timelineChapters(PIECE_SCHEDULE);
  const buttons = page.locator(
    conductor
      ? ".conductor__chapters button:not(:disabled)"
      : "[data-sections] button:not(:disabled)",
  );
  await buttons.nth(2).click();
  assert.ok(
    Math.abs(
      (await page.evaluate(() => window.show.sample().timeSeconds)) -
        chapters[2].startSeconds,
    ) < 0.001,
  );
  const scrubBounds = await track.boundingBox();
  assert.ok(scrubBounds);
  await page.mouse.move(
    scrubBounds.x + scrubBounds.width * 0.4,
    scrubBounds.y + scrubBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    scrubBounds.x + scrubBounds.width * 0.7,
    scrubBounds.y + scrubBounds.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  const sample = await page.evaluate(() => window.show.sample());
  assert.equal(sample.isPlaying, false);
  assert.ok(
    Math.abs(
      sample.timeSeconds -
        ((0.7 - 0.12) / 0.88) * PIECE_SCHEDULE.durationSeconds,
    ) < 1,
  );
  await verifyPlaybackControls(page, conductor);
  if (conductor) await verifyTimelineKeys(page);
}

async function verifyCancelledSkip() {
  const { page, errors } = await openRun("/");
  try {
    await page.evaluate(() => {
      window.timelineRun.skipTutorial(75);
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false }),
      );
    });
    await page.waitForFunction(
      () => window.timelineRun.audio.context.state === "closed",
    );
    assert.equal(await page.evaluate(() => !!window.show), false);
    assert.deepEqual(unexpectedErrors(errors), []);
    console.log("Tutorial skip cancellation: passed");
  } finally {
    await page.close();
  }
}

async function verifyProgressDisplay(page, conductor) {
  const readout = page.locator(
    conductor ? "[data-timeline-readout]" : "[data-readout]",
  );
  assert.match(await readout.textContent(), /Tutorial 0\/4/);
  const block = page.locator("[data-tutorial-block]");
  const initialWidth = (await block.boundingBox()).width;
  await page.evaluate(() => {
    const run = window.timelineRun;
    window.originalReadTutorial = run.readTutorial;
    run.readTutorial = () => ({
      completedChunks: 2,
      totalChunks: 4,
      phase: "active",
    });
  });
  await page.waitForFunction(() =>
    document.body.textContent.includes("Tutorial 2/4"),
  );
  assert.equal((await block.boundingBox()).width, initialWidth);
  await page.evaluate(() => {
    window.timelineRun.readTutorial = window.originalReadTutorial;
  });
  await page.waitForFunction(() =>
    document.body.textContent.includes("Tutorial 0/4"),
  );
}

async function verifyHeldTimeline(page) {
  await page.waitForTimeout(500);
  const mutations = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    observer.observe(document.querySelector(".timeline__track"), {
      attributes: true,
      subtree: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    observer.disconnect();
    return count;
  });
  assert.equal(
    mutations,
    0,
    "Held timeline must not repeat identical SVG writes",
  );
}

function unexpectedErrors(errors) {
  // Releasing tutorial HTMLAudioElement sources aborts pending voice requests.
  return errors.filter(
    (error) =>
      !/^request: .*\/audio\/tutorial\/.*: net::ERR_ABORTED$/.test(error),
  );
}

async function verifyPlaybackControls(page, conductor) {
  const transport = page.locator(
    conductor ? ".conductor__transport-button" : "[data-transport]",
  );
  assert.equal(await transport.isEnabled(), true);
  await transport.click();
  assert.equal(await page.evaluate(() => window.show.sample().isPlaying), true);
  await transport.click();
  assert.equal(
    await page.evaluate(() => window.show.sample().isPlaying),
    false,
  );
  await page.locator('[data-language="en"]').click();
  assert.equal(await page.evaluate(() => window.show.readLanguage()), "en");
}

async function verifyTimelineKeys(page) {
  const slider = page.locator(".conductor__timeline-slider");
  await slider.press("Home");
  assert.equal(await page.evaluate(() => window.show.sample().timeSeconds), 0);
  await slider.press("ArrowRight");
  const nudged = await page.evaluate(() => window.show.sample().timeSeconds);
  assert.ok(nudged > 0 && nudged < 30);
  await slider.press("ArrowLeft");
  assert.equal(await page.evaluate(() => window.show.sample().timeSeconds), 0);
  await slider.press("End");
  assert.equal(
    await page.evaluate(() => window.show.sample().timeSeconds),
    PIECE_SCHEDULE.durationSeconds,
  );
}
