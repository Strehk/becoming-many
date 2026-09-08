/**
 * Purpose: Lock the composed organ against the show it plays under.
 * Context: The composition is authored data ported from the instrument's own
 *   editor, so what it must satisfy is a contract, not an implementation.
 * Responsibility: Cover the voice vocabulary and the control ranges.
 * Boundary: How a voice sounds is not decidable outside a browser.
 */

import { describe, expect, test } from "bun:test";
import { ORGAN_VOICES } from "../../src/dramaturgy/organ-score";
import { DRONE_ORGAN_COMPOSITION } from "../../src/sound/drone-organ/drone-organ-settings";

const { layers } = DRONE_ORGAN_COMPOSITION;

function isControlValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

describe("the composed organ", () => {
  test("builds exactly one layer for every voice of the score", () => {
    const names = layers.map((layer) => layer.name);
    expect([...names].sort()).toEqual([...ORGAN_VOICES].sort());
  });

  test("keeps every control inside the range the knobs turned in", () => {
    for (const layer of layers) {
      expect(isControlValue(layer.volume)).toBe(true);
      expect(isControlValue(layer.roomSend)).toBe(true);
      expect(isControlValue(layer.cutoff)).toBe(true);
      expect(layer.pad.every(isControlValue)).toBe(true);
    }
  });

  test("patches signals into a reachable range", () => {
    const cables = layers.flatMap((layer) => [
      layer.modulation?.padX,
      layer.modulation?.padY,
    ]);
    for (const cable of cables) {
      if (!cable) continue;

      expect(isControlValue(cable.minimum)).toBe(true);
      expect(isControlValue(cable.maximum)).toBe(true);
      expect(isControlValue(cable.smoothing)).toBe(true);
      // A cable may run either way; a range that does not move is the bug.
      expect(cable.minimum).not.toBe(cable.maximum);
    }
  });

  test("places only what the moving world can carry", () => {
    for (const layer of layers) {
      const placement = layer.placement;
      if (!placement) continue;

      expect(["birds", "insects"]).toContain(placement.group);
      expect(isControlValue(placement.nearRadius)).toBe(true);
      expect(isControlValue(placement.falloff)).toBe(true);
    }
  });
});

test("audio owners recover gesture resume and await complete disposal", async () => {
  // Module mocks stay in a separate process; other sound tests see real imports.
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import { mock } from "bun:test";
    import assert from "node:assert/strict";
    const turn = () => new Promise(resolve => setTimeout(resolve, 0));
    const until = async (condition) => {
      for (let attempt = 0; attempt < 1000 && !condition(); attempt++) await turn();
      assert.ok(condition(), "audio lifecycle did not reach its boundary");
    };
    const contexts = [];
    class Context {
      state = "suspended"; currentTime = 0; disposed = 0;
      listener = Object.fromEntries(["positionX", "positionY", "positionZ", "forwardX", "forwardY", "forwardZ", "upX", "upY", "upZ"].map(name => [name, {
        value: 0, endSeconds: 0,
        linearRampToValueAtTime(value, endSeconds) { this.value = value; this.endSeconds = endSeconds; },
      }])); closing = false;
      rawContext = this;
      createGain() { return new Node(this); }
      immediate() { return this.currentTime; }
      release; closeCalls = 0; resumeCalls = 0; rejectResume = false;
      constructor() { contexts.push(this); }
      resume() {
        this.resumeCalls++;
        if (this.rejectResume) return Promise.reject(new Error("resume blocked"));
        this.state = "running";
        return Promise.resolve();
      }
      close() {
        this.closeCalls++;
        if (this.closing) return Promise.resolve();
        this.closing = true;
        return new Promise(resolve => { this.release = () => { this.state = "closed"; resolve(); }; });
      }
      dispose() {
        assert.equal(this.state, "closed", "dispose must follow awaited native close");
        this.disposed++; this.close();
      }
    }
    let context = new Context();
    let built = 0, ended = 0, layers = 0, releasedLayers = 0, failLayer = false;
    class Node {
      ready = Promise.resolve();
      constructor(context) { this.context = context; }
      connect() {} disconnect() {} toDestination() {} dispose() {}
    }
    mock.module("tone", () => ({
      Context, getContext: () => context, setContext: next => { context = next; },
      Gain: Node, Limiter: Node, Reverb: Node, Frequency: () => ({ toMidi: () => 60 }),
    }));
    globalThis.window = new EventTarget();
    async function checkGestureResume(audio) {
      audio.rejectResume = true;
      window.dispatchEvent(new Event("pointerdown")); await turn();
      assert.equal(audio.resumeCalls, 1); assert.equal(audio.state, "suspended");
      audio.rejectResume = false;
      window.dispatchEvent(new Event("keydown")); await turn();
      assert.equal(audio.resumeCalls, 2); assert.equal(audio.state, "running");
      window.dispatchEvent(new Event("pointerdown")); await turn();
      assert.equal(audio.resumeCalls, 2);
      audio.state = "suspended";
      window.dispatchEvent(new Event("pointerdown")); await turn();
      assert.equal(audio.resumeCalls, 3); assert.equal(audio.state, "running");
      audio.state = "suspended";
    }
    const { PerspectiveCamera } = await import("three");
    const { createSpatialAudio } = await import("./src/sound/spatial-audio.runtime.ts");
    const camera = new PerspectiveCamera();
    const audio = await createSpatialAudio(camera, new AbortController().signal);
    await checkGestureResume(context);
    context.state = "running";
    audio.update();
    await new Promise(resolve => setTimeout(resolve, 90));
    context.currentTime = 100;
    camera.position.set(2, 3, 4);
    audio.update(); audio.update(); audio.update();
    assert.equal(context.listener.positionX.value, 2);
    assert.ok(context.listener.positionX.endSeconds <= 100.034,
      "head movement after idle must not ramp over the entire idle interval");
    context.state = "suspended";
    mock.module("./src/sound/drone-organ/organ-engine.ts", () => ({
      createOrganEngine: async () => { built++; return { unload: async () => { ended++; } }; },
    }));
    mock.module("./src/sound/drone-organ/organ-layer.ts", () => ({
      createOrganLayer: () => {
        if (failLayer && layers++ > 0) throw new Error("voice construction failed");
        return { dispose: () => { releasedLayers++; } };
      },
    }));
    const { createDroneOrgan } = await import("./src/sound/drone-organ/drone-organ.ts");
    const cancelled = createDroneOrgan({ pulseSeconds: 1 }, audio);
    const cancelledEnd = cancelled.unload();
    assert.equal(cancelled.unload(), cancelledEnd);
    await cancelledEnd;
    assert.equal(built, 0);
    assert.equal(context.closing, false, "a follower cannot close a shared context");
    const next = createDroneOrgan({ pulseSeconds: 1 }, audio);
    await until(() => built === 1);
    await next.unload();
    assert.equal(ended, 1);
    assert.equal(releasedLayers, 9);
    assert.equal(context.closing, false);
    failLayer = true;
    console.error = () => {};
    const failed = createDroneOrgan({ pulseSeconds: 1 }, audio);
    await until(() => ended === 2);
    await assert.rejects(failed.unload(), /voice construction failed/);
    assert.equal(releasedLayers, 10);
    assert.equal(context.closing, false);
    const closing = audio.unload();
    assert.equal(audio.unload(), closing);
    await until(() => context.closing);
    assert.equal(context.closing, true);
    assert.equal(context.disposed, 0);
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("keydown")); await turn();
    assert.equal(context.resumeCalls, 3);
    let finished = false;
    void closing.then(() => { finished = true; });
    await turn(); assert.equal(finished, false);
    context.release(); await closing;
    assert.equal(context.disposed, 1);
    const old = context;
    const replacement = await createSpatialAudio(camera, new AbortController().signal);
    assert.notEqual(context, old);
    const replacementEnd = replacement.unload();
    await until(() => context.closing);
    context.release(); await replacementEnd;
    assert.equal(context.disposed, 1);
    const cancellation = new AbortController();
    cancellation.abort();
    const cancelledAudio = createSpatialAudio(camera, cancellation.signal);
    const cancellationFailure = assert.rejects(cancelledAudio, error => error.name === "AbortError");
    await until(() => context.closing && context.disposed === 0);
    context.release(); await cancellationFailure;
    assert.equal(context.disposed, 1);

    globalThis.window = new EventTarget();
    globalThis.AudioContext = Context;
    const { createAudioTimebase } = await import("./src/sound/audio-timebase.ts");
    const timebase = createAudioTimebase();
    const native = contexts.at(-1);
    await checkGestureResume(native);
    const nativeEnd = timebase.unload();
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("keydown")); await turn();
    assert.equal(native.resumeCalls, 3);
    assert.equal(timebase.unload(), nativeEnd);
    assert.equal(native.closeCalls, 1);
    native.release(); await nativeEnd;

    let releaseOrgan, organEnded = false, narrationCount = 0, follows = 0;
    let narrationUnloads = 0, failNarrationCleanup = false;
    const narrationOptions = [], narrationFrames = [];
    mock.module("./src/sound/drone-organ/drone-organ.ts", () => ({
      createDroneOrgan: () => ({
        update: () => { follows++; },
        unload: () => { organEnded = true; return new Promise(resolve => { releaseOrgan = resolve; }); },
      }),
    }));
    mock.module("./src/sound/narration-player.ts", () => ({
      createNarrationPlayer: options => {
        narrationCount++; narrationOptions.push(options);
        return { setRecordings: recordings => { narrationOptions.push({ recordings }); },
          follow: frame => { follows++; narrationFrames.push(frame); }, unload: () => {
          narrationUnloads++;
          if (failNarrationCleanup) throw new Error("media cleanup failed");
        } };
      },
    }));
    const { createShowRuntime } = await import("./src/levels/show.runtime.ts");
    const { PIECE_SCHEDULE } = await import("./src/dramaturgy/piece-schedule.ts");
    const { SHOW_LEVEL_STATES } = await import("./src/dramaturgy/show-levels.ts");
    const show = await createShowRuntime(
      { schedule: PIECE_SCHEDULE, language: "en", states: SHOW_LEVEL_STATES },
      { camera: { updateProjectionMatrix() {} }, renderer: { setClearColor() {} } },
      { gates: new Map(), senses: {}, worldFades: {} }, {}, audio,
    );
    const showNative = contexts.at(-1);
    showNative.state = "running";
    const commands = show.running;
    assert.equal("clock" in commands, false);
    commands.play(); showNative.currentTime = 2;
    assert.equal(commands.sample().timeSeconds, 2);
    commands.seekTo(20); commands.seekBy(-5); commands.setTimeScale(2);
    showNative.currentTime = 3;
    assert.equal(commands.sample().timeSeconds, 17);
    commands.togglePlayback();
    assert.equal(commands.sample().isPlaying, false);
    commands.togglePlayback();
    assert.equal(commands.sample().isPlaying, true);
    commands.setLanguage("de");
    assert.equal(commands.sample().isPlaying, true);
    assert.equal(commands.sample().timeSeconds, 17);
    assert.equal(commands.readLanguage(), "de");
    commands.setLanguage("de");
    assert.equal(narrationUnloads, 0); assert.equal(narrationCount, 1);
    showNative.currentTime = 4;
    assert.deepEqual(commands.sample(), { timeSeconds: 19, isPlaying: true, timeScale: 2 });
    commands.pause(); commands.setLanguage("en");
    showNative.currentTime = 5;
    assert.deepEqual(commands.sample(), { timeSeconds: 19, isPlaying: false, timeScale: 2 });
    assert.equal(commands.readLanguage(), "en");
    assert.equal(narrationUnloads, 0); assert.equal(narrationCount, 1);
    commands.play(); commands.resetTime();
    assert.deepEqual(commands.sample(), { timeSeconds: 0, isPlaying: false, timeScale: 2 });
    failNarrationCleanup = true;
    const showEnd = show.unload();
    const showFailure = assert.rejects(showEnd, error => error.errors.some(cause => /media cleanup/.test(cause.message)));
    assert.equal(show.unload(), showEnd);
    assert.equal(organEnded, true);
    assert.equal(showNative.closing, true);
    show.update(); show.running.setLanguage("en");
    assert.equal(follows, 0); assert.equal(narrationCount, 1);
    releaseOrgan(); showNative.release(); await showFailure;
    const contextCount = contexts.length;
    const invalidStart = createShowRuntime(
      { schedule: { ...PIECE_SCHEDULE, durationSeconds: -1 }, language: "en", states: SHOW_LEVEL_STATES },
      {}, {}, {}, audio,
    );
    await assert.rejects(invalidStart, /Show duration/);
    assert.equal(contexts.length, contextCount, "invalid schedules allocate no audio context");

    failNarrationCleanup = false;
    const tutorialWorld = {
      camera: new PerspectiveCamera(),
      renderer: { setClearColor() {} },
      modules: { activate() {}, deactivate() {} },
      viewpoint: { worldPosition: { x: 0, y: 0, z: 0 } },
    };
    let playing = false, resetCount = 0, finishes = 0, mayReadTraining = true;
    let observation, advanceAllowed;
    const training = {
      reset() {
        resetCount++;
        observation = { phase: "arrival", direction: "right", goalIndex: 0, crossingCount: 0 };
      },
      setPlaying(next) { playing = next; },
      setGoalAdvanceAllowed(next) { advanceAllowed = next; },
      readObservation() {
        assert.ok(mayReadTraining, "released training must not be read after handoff");
        return observation;
      },
    };
    const recordings = language => ["right", "left", "up", "down", "complete"].map(cueId => ({
      cueId, url: "/approved/" + language + "/" + cueId + ".wav", durationSeconds: 3,
    }));
    const tutorialDefinition = {
      start: training,
      parameters: {
        goals: ["right", "left", "up", "down"].map(direction => ({ direction })),
      },
      recordings: { en: recordings("en"), de: recordings("de") },
      finish: () => { finishes++; mayReadTraining = false; },
    };
    const trainingShow = await createShowRuntime(
      { schedule: PIECE_SCHEDULE, language: "en", states: SHOW_LEVEL_STATES },
      tutorialWorld, { gates: new Map(), senses: {}, worldFades: {} },
      { groundYAt: () => 0 }, audio, false, tutorialDefinition,
    );
    const trainingNative = contexts.at(-1);
    trainingNative.state = "running";
    assert.equal(narrationOptions.at(-1).recordings.length, PIECE_SCHEDULE.narration.length + 5);
    assert.ok(narrationOptions.at(-1).recordings.some(clip => clip.cueId === "prologue"),
      "main speech must already be prepared before the first tutorial frame");
    const tutorialCommands = trainingShow.running;
    assert.equal(resetCount, 1); assert.equal(playing, false);
    trainingShow.setPreparationState("loading");
    tutorialCommands.play(); tutorialCommands.togglePlayback();
    assert.equal(tutorialCommands.sample().isPlaying, false);
    assert.equal(tutorialCommands.readTutorial().phase, "loading");
    trainingShow.setPreparationState("failed");
    assert.equal(tutorialCommands.readTutorial().phase, "failed");
    tutorialCommands.play(); assert.equal(tutorialCommands.sample().isPlaying, false);
    trainingShow.setTutorial(tutorialDefinition);
    resetCount = 1;
    trainingShow.setPreparationState("ready");
    tutorialCommands.play(); trainingNative.currentTime = 1; trainingShow.update();
    assert.equal(playing, true);
    assert.equal(advanceAllowed, false, "a fast crossing cannot interrupt speech");
    assert.equal(narrationFrames.at(-1).position.cueId, "right");
    assert.equal(narrationFrames.at(-1).position.offsetSeconds, 1);
    tutorialCommands.pause(); trainingNative.currentTime = 2; trainingShow.update();
    assert.equal(playing, false);
    assert.equal(narrationFrames.at(-1).position.offsetSeconds, 1);
    tutorialCommands.play(); trainingNative.currentTime = 3;
    tutorialCommands.seekTo(100); tutorialCommands.seekBy(20); tutorialCommands.setTimeScale(2);
    trainingShow.update();
    assert.equal(tutorialCommands.sample().timeScale, 1);
    assert.equal(tutorialCommands.sample().timeSeconds, 0);
    assert.equal(narrationFrames.at(-1).position.offsetSeconds, 2);
    tutorialCommands.setLanguage("de"); trainingShow.update();
    assert.equal(narrationFrames.at(-1).position.offsetSeconds, 0);
    assert.ok(narrationOptions.at(-1).recordings.every(clip => clip.url.includes("/de/")));
    observation = { phase: "flying", direction: "left", goalIndex: 1, crossingCount: 1 };
    trainingNative.currentTime = 4; trainingShow.update();
    assert.equal(narrationFrames.at(-1).position.cueId, "left");
    assert.equal(narrationFrames.at(-1).position.offsetSeconds, 0);
    tutorialCommands.resetTime(); trainingShow.update();
    assert.equal(resetCount, 2); assert.equal(playing, false);
    assert.equal(tutorialCommands.readTutorial().phase, "arrival");
    assert.equal(narrationFrames.at(-1).position.cueId, "right");
    assert.equal(narrationFrames.at(-1).position.offsetSeconds, 0);
    tutorialCommands.play(); trainingNative.currentTime = 5; trainingShow.update();
    observation = { phase: "crossed", direction: "down", goalIndex: 3, crossingCount: 4 };
    trainingNative.currentTime = 6; trainingShow.update();
    tutorialCommands.continueToExperience();
    assert.equal(finishes, 0);
    observation.phase = "complete";
    trainingNative.currentTime = 7; trainingShow.update();
    assert.equal(tutorialCommands.readTutorial().readyToContinue, false);
    tutorialCommands.continueToExperience(); assert.equal(finishes, 0);
    trainingNative.currentTime = 9; trainingShow.update();
    assert.equal(narrationFrames.at(-1).position.cueId, "complete");
    trainingNative.currentTime = 12; trainingShow.update();
    assert.equal(tutorialCommands.readTutorial().readyToContinue, true);
    assert.equal(finishes, 0, "completion waits for the operator after the final spoken clip");
    const preparedNarratorCount = narrationCount;
    tutorialCommands.continueToExperience(); tutorialCommands.continueToExperience();
    assert.equal(narrationCount, preparedNarratorCount, "handoff reuses the prepared owner");
    assert.equal(narrationOptions.at(-1).recordings.length, PIECE_SCHEDULE.narration.length);
    assert.ok(narrationOptions.at(-1).recordings.every(clip => !clip.url.includes("/approved/")),
      "handoff retires only tutorial recordings");
    assert.equal(finishes, 1); assert.equal(tutorialCommands.readTutorial(), undefined);
    tutorialCommands.seekTo(20); tutorialCommands.seekBy(-5); tutorialCommands.setTimeScale(2);
    trainingNative.currentTime = 13; trainingShow.update();
    assert.deepEqual(tutorialCommands.sample(), { timeSeconds: 17, isPlaying: true, timeScale: 2 });
    const trainingShowEnd = trainingShow.unload();
    releaseOrgan(); trainingNative.release(); await trainingShowEnd;

    for (const standalone of [false, true]) {
      mayReadTraining = true;
      const silentTutorial = await createShowRuntime(
        { schedule: PIECE_SCHEDULE, language: "en", states: SHOW_LEVEL_STATES },
        tutorialWorld, { gates: new Map(), senses: {}, worldFades: {} },
        { groundYAt: () => 0 }, undefined, standalone,
        { ...tutorialDefinition, recordings: undefined },
      );
      assert.equal(narrationOptions.at(-1).recordings.length,
        standalone ? 0 : PIECE_SCHEDULE.narration.length,
        "a silent integrated tutorial preloads main clips; standalone never does");
      silentTutorial.setTutorial(tutorialDefinition);
      assert.equal(narrationOptions.at(-1).recordings.length,
        standalone ? 5 : PIECE_SCHEDULE.narration.length + 5);
      silentTutorial.running.setLanguage("de");
      assert.equal(narrationOptions.at(-1).recordings.length,
        standalone ? 5 : PIECE_SCHEDULE.narration.length + 5);
      const silentNative = contexts.at(-1);
      const silentEnd = silentTutorial.unload();
      silentNative.release(); await silentEnd;
    }


  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});
