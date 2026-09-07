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

test("audio owners await late starts and native close before disposal or reuse", async () => {
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
      state = "suspended"; listener = {}; disposed = 0; closing = false;
      release; closeCalls = 0;
      constructor() { contexts.push(this); }
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
    mock.module("tone", () => ({ Context, getContext: () => context, setContext: next => { context = next; } }));
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
    const cancelled = createDroneOrgan({ pulseSeconds: 1 });
    const closing = cancelled.unload();
    assert.equal(cancelled.unload(), closing);
    await until(() => context.closing);
    assert.equal(built, 0);
    assert.equal(context.closing, true);
    assert.equal(context.disposed, 0);
    let finished = false;
    void closing.then(() => { finished = true; });
    await turn(); assert.equal(finished, false);
    context.release(); await closing;
    assert.equal(context.disposed, 1);
    const old = context;
    const next = createDroneOrgan({ pulseSeconds: 1 });
    await until(() => built === 1);
    assert.notEqual(context, old);
    assert.equal(built, 1);
    const nextClosing = next.unload();
    await until(() => context.closing); assert.equal(ended, 1);
    assert.equal(releasedLayers, 9);
    assert.equal(context.disposed, 0);
    context.release(); await nextClosing;
    assert.equal(old.disposed, 1);
    failLayer = true;
    console.error = () => {};
    const failed = createDroneOrgan({ pulseSeconds: 1 });
    await until(() => context !== old && context.closing && ended === 2);
    assert.equal(context.closing, true);
    context.release(); await turn();
    await assert.rejects(failed.unload(), /voice construction failed/);
    assert.equal(context.disposed, 1);
    assert.equal(releasedLayers, 10);

    globalThis.window = new EventTarget();
    globalThis.AudioContext = Context;
    const { createAudioTimebase } = await import("./src/sound/audio-timebase.ts");
    const timebase = createAudioTimebase();
    const native = contexts.at(-1);
    const nativeEnd = timebase.unload();
    assert.equal(timebase.unload(), nativeEnd);
    assert.equal(native.closeCalls, 1);
    native.release(); await nativeEnd;

    let releaseOrgan, organEnded = false, narrationCount = 0, follows = 0;
    mock.module("./src/sound/drone-organ/drone-organ.ts", () => ({
      createDroneOrgan: () => ({
        update: () => { follows++; },
        unload: () => { organEnded = true; return new Promise(resolve => { releaseOrgan = resolve; }); },
      }),
    }));
    mock.module("./src/sound/narration-player.ts", () => ({
      createNarrationPlayer: () => {
        narrationCount++;
        return { follow: () => { follows++; }, unload: () => { throw new Error("media cleanup failed"); } };
      },
    }));
    const { createShowRuntime } = await import("./src/levels/show-runtime.ts");
    const { PIECE_SCHEDULE } = await import("./src/dramaturgy/piece-schedule.ts");
    const { SHOW_LEVEL_STATES } = await import("./src/dramaturgy/show-levels.ts");
    const show = await createShowRuntime(
      { schedule: PIECE_SCHEDULE, language: "en", states: SHOW_LEVEL_STATES },
      { camera: { updateProjectionMatrix() {} }, renderer: { setClearColor() {} } },
      { gates: new Map(), senses: {}, worldFades: {} }, {},
    );
    const showNative = contexts.at(-1);
    const showEnd = show.unload();
    const showFailure = assert.rejects(showEnd, error => error.errors.some(cause => /media cleanup/.test(cause.message)));
    assert.equal(show.unload(), showEnd);
    assert.equal(organEnded, true);
    assert.equal(showNative.closing, true);
    show.update(); show.running.setLanguage("de");
    assert.equal(follows, 0); assert.equal(narrationCount, 1);
    releaseOrgan(); showNative.release(); await showFailure;
    const invalidStart = createShowRuntime(
      { schedule: { ...PIECE_SCHEDULE, durationSeconds: -1 }, language: "en", states: SHOW_LEVEL_STATES },
      {}, {}, {},
    );
    const failedStartEnd = assert.rejects(invalidStart, /Show duration/);
    assert.equal(contexts.at(-1).closing, true);
    contexts.at(-1).release(); await failedStartEnd;


  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});
