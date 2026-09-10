import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.route("**/audio-probe", (r) =>
  r.fulfill({ contentType: "text/html", body: "<html></html>" }),
);
await page.goto("http://127.0.0.1:4180/audio-probe");
const observations = await page.evaluate(async (root) => {
  const { createSpatialAudio } = await import(
    `/@fs${root}src/sound/spatial-audio.runtime.ts`
  );
  const { createStartAudio } = await import(
    `/@fs${root}src/modules/start/audio/start-audio.ts`
  );
  const { START_AUDIO_SETTINGS } = await import(
    `/@fs${root}src/modules/start/audio/audio-settings.ts`
  );
  const { PerspectiveCamera, Vector3 } = await import(
    `/@fs${root}node_modules/.vite/deps/three.js`
  );
  const owner = await createSpatialAudio(
    new PerspectiveCamera(),
    new AbortController().signal,
  );
  await owner.context.resume();
  owner.update();
  const audio = await createStartAudio({
    ...owner,
    settings: START_AUDIO_SETTINGS,
  });
  window.probe = { owner, audio };
  audio.configureSection(0, {
    center: new Vector3(3, 0, -3),
    rings: [
      {
        index: 0,
        center: new Vector3(3, 0, -3),
        direction: new Vector3(0, 0, 1),
        radiusMeters: 3.6,
      },
    ],
  });
  audio.update({ active: true, speaking: true });
  audio.updateSection(0, { presence: [1], pulses: [1] });
  const section = audio.sections.get(0);
  const ring = section.rings[0];
  const splitter = owner.listener.context.createChannelSplitter(2);
  owner.listener.gain.connect(splitter);
  const analysers = [0, 1].map((i) => {
    const a = owner.listener.context.createAnalyser();
    a.fftSize = 2048;
    splitter.connect(a, i);
    return a;
  });
  window.probe.analysers = analysers;
  return {
    context: owner.context.state,
    clicks: ring.clicks.length,
    detunes: ring.clicks.map((v) => v.player.detune),
    distances: ring.clicks.map((v) =>
      v.spatial.position.distanceTo(ring.pulse.spatial.position),
    ),
    heads: section.beds.length,
    bedPitch: section.beds.map((v) => v.player.detune),
    padGain: audio.pad.targetGain,
    expectedDuck: 10 ** (START_AUDIO_SETTINGS.padSpeakingDb / 20),
    pulse: ring.pulse.player.state,
  };
}, root);
assert.equal(observations.clicks, 3);
assert.equal(observations.heads, 3);
assert.ok(observations.detunes.every((v) => v >= -2400 && v <= 0));
assert.ok(observations.distances.every((v) => Math.abs(v - 3.6) < 1e-6));
assert.deepEqual(observations.bedPitch, [0, 0, 0]);
assert.equal(observations.padGain, observations.expectedDuck);
assert.equal(observations.pulse, "started");
await page.waitForTimeout(1000);
const signal = await page.evaluate(() =>
  window.probe.analysers.map((a) => {
    const v = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(v);
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length);
  }),
);
assert.ok(signal.every((rms) => rms > 0 && rms < 0.05));
const unducked = await page.evaluate(() => {
  const a = window.probe.audio;
  a.update({ active: true, speaking: false });
  return a.pad.targetGain;
});
assert.ok(unducked > observations.padGain);
const cleanup = await page.evaluate(async () => {
  const { audio, owner } = window.probe;
  audio.clearSection(0);
  const remaining = audio.sections.size;
  audio.unload();
  audio.unload();
  await owner.unload();
  return { remaining, context: owner.context.state, disposed: audio.disposed };
});
assert.deepEqual(cleanup, { remaining: 0, context: "closed", disposed: true });
assert.deepEqual(errors, []);
console.log(
  "Start spatial audio: placement, output, ducking and cleanup passed.",
);
await browser.close();
