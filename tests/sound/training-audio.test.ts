import { expect, test } from "bun:test";
import {
  type TrainingAudioParameters,
  validateTrainingAudioParameters,
} from "../../src/sound/training-audio.runtime";

const parameters: TrainingAudioParameters = {
  sampleUrl: "/audio/test.wav",
  grainSizeSeconds: 0.18,
  overlapSeconds: 0.04,
  playbackRate: 0.6,
  objectVolumeDb: -24,
  ambientVolumeDb: -38,
  referenceDistanceMeters: 3,
  maximumDistanceMeters: 96,
  rolloffFactor: 0.65,
};

test("training grain budgets reject unbounded scheduling before loading", () => {
  expect(() => validateTrainingAudioParameters(parameters)).not.toThrow();
  for (const invalid of [
    { grainSizeSeconds: 0 },
    { grainSizeSeconds: 0.04 },
    { grainSizeSeconds: Number.NaN },
    { overlapSeconds: 0.5 },
    { playbackRate: 100 },
    { playbackRate: 0 },
    { referenceDistanceMeters: 0 },
    { maximumDistanceMeters: 1 },
    { objectVolumeDb: Number.POSITIVE_INFINITY },
  ]) {
    expect(() =>
      validateTrainingAudioParameters({ ...parameters, ...invalid }),
    ).toThrow("Invalid or unbounded training audio parameters");
  }
});

test("interactive clips reuse narration pause, cue replacement and full cleanup", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
      import assert from "node:assert/strict";
      const elements = [];
      class Audio {
        currentTime = 0; paused = true; readyState = 1; playbackRate = 1;
        loads = 0; plays = 0;
        constructor(src) { this.src = src; elements.push(this); }
        play() { this.paused = false; this.plays++; return Promise.resolve(); }
        pause() { this.paused = true; }
        removeAttribute(name) { if (name === "src") this.src = ""; }
        load() { this.loads++; }
      }
      globalThis.Audio = Audio;
      globalThis.HTMLMediaElement = { HAVE_METADATA: 1 };
      const { createNarrationPlayer } = await import("./src/sound/narration-player.ts");
      const player = createNarrationPlayer({ recordings: [
        { cueId: "right", url: "/approved/right.wav", durationSeconds: 7 },
        { cueId: "left", url: "/approved/left.wav", durationSeconds: 5 },
      ] });
      const follow = (cueId, offsetSeconds, isPlaying = true) => player.follow({
        position: { cueId, offsetSeconds }, isPlaying, timeScale: 1,
      });
      follow("right", 0);
      assert.equal(elements[0].plays, 1);
      follow("right", 3, false);
      assert.equal(elements[0].paused, true);
      assert.equal(elements[0].currentTime, 3);
      follow("right", 3);
      assert.equal(elements[0].plays, 2);
      follow("left", 0);
      assert.equal(elements[0].paused, true);
      assert.equal(elements[1].paused, false);
      follow("left", 5);
      assert.equal(elements[1].paused, true);
      const playCount = elements[1].plays;
      follow("left", 8);
      assert.equal(elements[1].plays, playCount, "finished speech must not loop while a goal remains");
      player.unload(); player.unload();
      follow("right", 0);
      assert.ok(elements.every(element => element.paused && !element.src && element.loads === 1));

      const { createTrainingAudio } = await import("./src/sound/training-audio.runtime.ts");
      globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
      let finishDecode, createdNodes = 0;
      const cancellation = new AbortController();
      const pending = createTrainingAudio({
        sampleUrl: "/approved/sample.wav", grainSizeSeconds: 0.18,
        overlapSeconds: 0.04, playbackRate: 0.6, objectVolumeDb: -24,
        ambientVolumeDb: -38, referenceDistanceMeters: 3,
        maximumDistanceMeters: 96, rolloffFactor: 0.65,
      }, { context: {
        decodeAudioData: () => new Promise(resolve => { finishDecode = resolve; }),
        createGain: () => { createdNodes++; },
      } }, cancellation.signal);
      const failure = assert.rejects(pending, error => error.name === "AbortError");
      while (!finishDecode) await new Promise(resolve => setTimeout(resolve, 0));
      cancellation.abort();
      finishDecode({});
      await failure;
      assert.equal(createdNodes, 0, "late sample decoding must not publish nodes after cancellation");
      `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});

test("a dissolved goal stops grains throughout the spoken-instruction hold", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
      import { mock } from "bun:test";
      import assert from "node:assert/strict";
      const voices = [];
      class Player {
        starts = 0; stops = 0; ends = 0;
        constructor() { voices.push(this); }
        connect() {} toDestination() {}
        start() { this.starts++; }
        stop() { this.stops++; }
        dispose() { this.ends++; }
      }
      mock.module("tone", () => ({ GrainPlayer:Player, Player }));
      globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
      let sourceEnds = 0, inputEnds = 0;
      const { createTrainingAudio } = await import("./src/sound/training-audio.runtime.ts");
      const audio = await createTrainingAudio(${JSON.stringify(parameters)}, {
        context: {
          state:"running", now:()=>1, immediate:()=>1,
          decodeAudioData:async()=>({}),
          createGain:()=>({
            gain:{cancelScheduledValues(){},setTargetAtTime(){}},
            disconnect(){inputEnds++;},
          }),
        },
        createSource:()=>({setPosition(){},unload(){sourceEnds++;}}),
      }, new AbortController().signal);
      const [goal, ambient] = voices;
      const frame = {
        phase:"forming",formationProgress:0.5,
        goalPosition:{x:3,y:0,z:-5},
      };
      audio.update(frame,true);
      frame.phase="flying";frame.formationProgress=1;audio.update(frame,true);
      assert.equal(goal.starts,1);assert.equal(ambient.starts,1);
      frame.phase="crossed";frame.formationProgress=0.25;audio.update(frame,true);
      assert.equal(goal.stops,0,"the audible dissolution may finish");
      frame.formationProgress=0;
      for(let step=0;step<100;step++)audio.update(frame,true);
      assert.equal(goal.stops,1,"the dissolved goal must stop its grain clock");
      assert.equal(goal.starts,1,"a speech hold must not restart silent grains");
      assert.equal(ambient.stops,0,"the quiet bed remains during the speech hold");
      audio.update(frame,false);
      assert.equal(ambient.stops,1);assert.equal(goal.stops,1);
      audio.update(frame,true);
      assert.equal(ambient.starts,2);assert.equal(goal.starts,1);
      frame.phase="forming";frame.formationProgress=0.1;audio.update(frame,true);
      assert.equal(goal.starts,2,"the next visible goal resumes the single voice");
      audio.update(frame,false);
      assert.equal(goal.stops,2);assert.equal(ambient.stops,2);
      audio.unload();audio.unload();audio.update(frame,true);
      assert.equal(goal.ends,1);assert.equal(ambient.ends,1);
      assert.equal(sourceEnds,1);assert.equal(inputEnds,1);
      assert.equal(goal.starts,2);assert.equal(ambient.starts,2);
      `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});
