import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { assertRefactorBranch } from "./browser-evidence";

assertRefactorBranch();
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4180";
const output = process.argv[3] ?? "/tmp/becoming-many-language-report";
await mkdir(output, { recursive: true });
const results = [];
const selectedCases = process.argv.slice(4);
const browser = await chromium.launch({
  headless: true,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--use-angle=metal",
    "--enable-gpu",
  ],
});

try {
  if (!selectedCases.length || selectedCases.includes("conductor"))
    await verifyConductor();
  if (!selectedCases.length || selectedCases.includes("audience"))
    await verifyAudience();
  if (!selectedCases.length || selectedCases.includes("course"))
    await verifyCourseLanguage();
  await writeFile(
    `${output}/browser-results${selectedCases.length ? `-${selectedCases.join("-")}` : ""}.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}

async function openRun(path) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/@vite/client", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.route("**/src/levels/level.runtime.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes("return run;"));
    await route.fulfill({
      response,
      body: source.replace(
        "return run;",
        "window.languageRun = run; return run;",
      ),
    });
  });
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.languageMedia = [];
    window.Audio = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.languageMedia.push(this);
      }
    };
  });
  await page.goto(`${baseUrl}${path}`);
  await page.waitForFunction(() => window.languageRun?.readTutorial(), null, {
    timeout: 120000,
  });
  await page.waitForFunction(
    () => !document.querySelector(".conductor")?.inert,
  );
  await page.evaluate(() => {
    const run = window.languageRun;
    window.languageOwners = {
      renderer: run.world.renderer,
      tutorial: run.tutorial,
      start: run.tutorial.tutorial,
      context: run.audio.context,
    };
  });
  return { page, errors };
}

async function select(page, language) {
  await page.locator(`[data-language="${language}"]`).click();
  await page.waitForFunction(
    (language) => window.languageRun.readLanguage() === language,
    language,
  );
}

async function waitForVoice(page, language) {
  await page.waitForFunction(
    (language) => {
      const voice = window.languageRun.tutorial?.voice;
      return (
        voice?.audio.src.includes(`/tutorial/${language}/`) &&
        !voice.replacement
      );
    },
    language,
    { timeout: 15000 },
  );
}

async function sample(page) {
  return page.evaluate(() => {
    const run = window.languageRun;
    const start = run.tutorial?.tutorial;
    return {
      language: run.readLanguage(),
      playback: run.readPlayback(),
      position: run.world.viewerRig.position.toArray(),
      progress: run.readTutorial()?.completedChunks,
      phase: start?.game.readState().phase,
      offset: run.tutorial?.voice.read().offsetSeconds,
      showTime: run.show?.sample().timeSeconds,
      source: run.tutorial?.voice.audio.src,
      sameTutorial: run.tutorial === window.languageOwners.tutorial,
      sameRenderer: run.world.renderer === window.languageOwners.renderer,
      sameContext: run.audio.context === window.languageOwners.context,
      tutorialSources: window.languageMedia.filter((clip) =>
        clip.getAttribute("src")?.includes("/tutorial/"),
      ).length,
    };
  });
}

async function assertMoving(page, label) {
  const before = await sample(page);
  const states = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const states = [];
        const timer = setInterval(() => {
          states.push(window.languageRun.readPlayback());
          if (states.length === 25) {
            clearInterval(timer);
            resolve(states);
          }
        }, 20);
      }),
  );
  const after = await sample(page);
  assert.ok(
    states.every((state) => state === "playing"),
    `${label}: ${states}`,
  );
  assert.notDeepEqual(
    after.position,
    before.position,
    `${label}: flight keeps moving`,
  );
  assert.ok(
    after.sameRenderer && after.sameContext && after.sameTutorial,
    `${label}: owners survive`,
  );
  assert.ok(after.offset >= before.offset, `${label}: cue time cannot rewind`);
  results.push({ case: label, before, after });
}

async function assertHeld(page) {
  const before = await sample(page);
  await page.waitForTimeout(250);
  const after = await sample(page);
  assert.equal(after.playback, "paused");
  assert.deepEqual(after.position, before.position);
  assert.equal(after.offset, before.offset);
}

async function delayRecording(page, pattern) {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const handler = async (route) => {
    await gate;
    await route.continue().catch(() => {});
  };
  await page.route(pattern, handler);
  return async () => {
    release();
    await page.unroute(pattern, handler);
  };
}

async function verifyConductor() {
  const { page, errors } = await openRun("/conductor.html?language=en");
  try {
    assert.equal(await page.locator('[data-language="en"]').isEnabled(), true);
    await select(page, "de");
    await waitForVoice(page, "de");
    await assertHeld(page);
    assert.equal((await sample(page)).sameTutorial, true);
    await page.screenshot({ path: `${output}/01-before-play-german.png` });
    results.push({ case: "language before Play", state: await sample(page) });

    await page.locator(".conductor__transport-button").click();
    await page.waitForFunction(
      () => window.languageRun.tutorial.voice.read().offsetSeconds > 0.5,
    );
    const releaseEnglish = await delayRecording(
      page,
      "**/audio/tutorial/en/introduction-right.wav",
    );
    await select(page, "en");
    await assertMoving(page, "delayed replacement keeps old speech and flight");
    assert.ok((await sample(page)).source.includes("/de/"));
    assert.equal((await sample(page)).tutorialSources, 2);
    await releaseEnglish();
    await waitForVoice(page, "en");
    await assertMoving(page, "English replacement keeps tutorial running");

    await select(page, "de");
    await select(page, "en");
    await select(page, "de");
    await waitForVoice(page, "de");
    assert.equal((await sample(page)).tutorialSources, 1);
    const mediaCount = await page.evaluate(() => window.languageMedia.length);
    await select(page, "de");
    assert.equal(
      await page.evaluate(() => window.languageMedia.length),
      mediaCount,
    );
    await page.locator('[data-language="de"]').blur();
    await page.keyboard.press("l");
    await waitForVoice(page, "en");
    results.push({
      case: "rapid selection, same-language no-op and L shortcut",
      state: await sample(page),
    });

    const releaseGerman = await delayRecording(
      page,
      "**/audio/tutorial/de/introduction-right.wav",
    );
    await select(page, "de");
    await page.locator(".conductor__transport-button").click();
    await assertHeld(page);
    const heldOffset = (await sample(page)).offset;
    await releaseGerman();
    await waitForVoice(page, "de");
    assert.ok(Math.abs((await sample(page)).offset - heldOffset) < 0.1);
    await assertHeld(page);
    await page.locator(".conductor__transport-button").click();
    await assertMoving(
      page,
      "Pause during replacement and Resume preserve intent",
    );

    const failedPattern = "**/audio/tutorial/en/introduction-right.wav";
    await page.route(failedPattern, (route) =>
      route.fulfill({ status: 503, body: "Unavailable" }),
    );
    await select(page, "en");
    await page.waitForTimeout(200);
    await assertMoving(page, "failed replacement retains usable German source");
    assert.ok((await sample(page)).source.includes("/de/"));
    await page.unroute(failedPattern);
    await select(page, "de");
    await select(page, "en");
    await waitForVoice(page, "en");

    await page.waitForFunction(
      () => window.languageRun.tutorial.voice.read().offsetSeconds > 13.8,
    );
    const beforeReveal = await page.evaluate(
      () => window.languageRun.tutorial.tutorial.worldPresence,
    );
    await select(page, "de");
    await waitForVoice(page, "de");
    assert.ok(
      await page.evaluate(
        (before) =>
          window.languageRun.tutorial.tutorial.worldPresence >= before,
        beforeReveal,
      ),
    );
    await page.screenshot({ path: `${output}/02-live-tutorial-german.png` });
    await assertMoving(
      page,
      "spoken reveal markers remain monotonic after live switch",
    );

    const releaseDuringSkip = await delayRecording(
      page,
      "**/audio/tutorial/en/introduction-right.wav",
    );
    await select(page, "en");
    await page
      .locator(".conductor__chapters button:not([data-tutorial])")
      .first()
      .click();
    await page.waitForFunction(() => !!window.show, null, { timeout: 15000 });
    await releaseDuringSkip();
    assert.equal((await sample(page)).tutorialSources, 0);
    await verifyMainShow(page);

    await page.locator(".conductor__stop-button").click();
    await page.waitForFunction(
      () => window.languageRun.readTutorial()?.phase === "active",
    );
    await select(page, "de");
    await waitForVoice(page, "de");
    await assertHeld(page);
    await page.screenshot({
      path: `${output}/04-after-stop-language-available.png`,
    });
    results.push({
      case: "Stop leaves language available",
      state: await sample(page),
    });
    const releaseUnload = await delayRecording(
      page,
      "**/audio/tutorial/en/introduction-right.wav",
    );
    await select(page, "en");
    await unload(page);
    await releaseUnload();
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function verifyMainShow(page) {
  await page.waitForFunction(() => window.show.sample().timeSeconds > 6);
  await waitForMainVoice(page, "en");
  const pattern = "**/audio/narration/de/**";
  const release = await delayRecording(page, pattern);
  const before = await sample(page);
  await select(page, "de");
  await page.waitForTimeout(500);
  const after = await sample(page);
  assert.equal(after.playback, "playing");
  assert.ok(after.showTime > before.showTime);
  assert.ok(after.sameRenderer && after.sameContext);
  assert.equal(
    await page.evaluate(() =>
      window.languageMedia.some(
        (clip) =>
          clip.src.includes("/narration/en/prologue.mp3") &&
          !clip.paused &&
          !clip.muted,
      ),
    ),
    true,
    "old main narration remains audible while replacement loads",
  );
  await release();
  await waitForMainVoice(page, "de");
  await select(page, "en");
  await select(page, "de");
  await waitForMainVoice(page, "de");
  await page.screenshot({ path: `${output}/03-live-main-show-german.png` });
  await page.locator(".conductor__transport-button").click();
  const heldTime = (await sample(page)).showTime;
  await select(page, "en");
  assert.equal((await sample(page)).showTime, heldTime);
  assert.equal((await sample(page)).playback, "paused");
  results.push({
    case: "main Show live and paused language preserve clock",
    before,
    after,
  });
}

async function waitForMainVoice(page, language) {
  await page.waitForFunction(
    (language) =>
      window.languageMedia.some(
        (clip) =>
          clip.src.includes(`/narration/${language}/prologue.mp3`) &&
          !clip.paused &&
          !clip.muted &&
          !clip.seeking &&
          clip.readyState >= 2,
      ),
    language,
    { timeout: 15000 },
  );
}

async function verifyAudience() {
  const { page, errors } = await openRun("/?language=de");
  try {
    await page.waitForFunction(
      () => window.languageRun.readPlayback() === "playing",
    );
    await select(page, "en");
    await waitForVoice(page, "en");
    await assertMoving(
      page,
      "audience language uses the same live Run capability",
    );
    await page.screenshot({ path: `${output}/05-audience-live-english.png` });
    await unload(page);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function unload(page) {
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    ),
  );
  await page.waitForFunction(
    () => window.languageOwners.context.state === "closed",
  );
  assert.equal(
    await page.evaluate(() =>
      window.languageMedia.every(
        (clip) => !clip.getAttribute("src") && clip.paused,
      ),
    ),
    true,
  );
  results.push({
    case: "unload releases current and pending audio",
    passed: true,
  });
}

async function verifyCourseLanguage() {
  const { page, errors } = await openRun("/conductor.html?language=de");
  try {
    await page.locator(".conductor__transport-button").click();
    for (let index = 0; index < 4; index++) {
      await page.waitForFunction(
        (index) => {
          const state = window.languageRun.tutorial?.tutorial.game.readState();
          return state?.exerciseIndex === index && state.phase === "flying";
        },
        index,
        { timeout: 40000 },
      );
      await flyThroughRings(page);
      await page.waitForFunction(
        (progress) =>
          window.languageRun.readTutorial()?.completedChunks === progress,
        index + 1,
      );
      const language = index % 2 ? "de" : "en";
      await select(page, language);
      await waitForVoice(page, language);
      assert.equal((await sample(page)).progress, index + 1);
      assert.equal((await sample(page)).sameTutorial, true);
      results.push({
        case: `earned lesson ${index + 1} survives successor/closing language switch`,
        state: await sample(page),
      });
    }
    await page.waitForFunction(
      () => window.languageRun.tutorial.voice.read().offsetSeconds > 3.5,
    );
    const closing = await page.evaluate(() => ({
      ...window.languageRun.tutorial.tutorial.closing,
    }));
    await select(page, "en");
    await waitForVoice(page, "en");
    const after = await page.evaluate(() => ({
      ...window.languageRun.tutorial.tutorial.closing,
    }));
    assert.ok(after.course <= closing.course && after.world <= closing.world);
    await page.screenshot({ path: `${output}/06-closing-live-language.png` });
    await page.waitForFunction(() => !!window.show, null, { timeout: 20000 });
    assert.equal((await sample(page)).language, "en");
    assert.equal((await sample(page)).tutorialSources, 0);
    results.push({
      case: "closing fades never rewind and natural handoff preserves language",
      passed: true,
    });
    await unload(page);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

/** Drive the existing rig along its real course, letting native passage detection earn lessons. */
async function flyThroughRings(page) {
  await page.evaluate(async () => {
    const run = window.languageRun;
    const start = run.tutorial.tutorial;
    const section = start.current;
    const initialProgress = run.readTutorial().completedChunks;
    const position = run.world.viewerRig.position;
    const direction = position.clone();
    const forward = direction.clone().set(0, 0, -1);
    for (
      let meters = -1;
      meters <= section.route.exerciseEndMeters + 0.4;
      meters += 0.3
    ) {
      section.route.sample(meters, position);
      position
        .applyAxisAngle(run.world.scene.up, section.pose.yawRadians)
        .add(section.pose.position);
      section.route.sampleDirection(meters, direction);
      direction.applyAxisAngle(run.world.scene.up, section.pose.yawRadians);
      run.world.viewerRig.quaternion.setFromUnitVectors(forward, direction);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (run.readTutorial().completedChunks > initialProgress) return;
    }
  });
}
