import { expect, test } from "bun:test";
import { level } from "../../src/levels/start.level";
import {
  type TrainingAudioParameters,
  validateTrainingAudioParameters,
} from "../../src/sound/training-audio.runtime";

const grain = {
  sampleId: "a",
  grainSizeSeconds: 0.25,
  overlapSeconds: 0.08,
  playbackRate: 0.6,
  volumeDb: -24,
  detuneCents: 0,
};
const parameters: TrainingAudioParameters = {
  samples: [{ id: "a", url: "/audio/test.wav" }],
  layers: [
    { ...grain, object: "ringLeft" },
    { ...grain, object: "ringRight" },
    { ...grain, object: "arrow" },
  ],
  goal: { ...grain, grainSizeSeconds: 0.18 },
  referenceDistanceMeters: 3,
  maximumDistanceMeters: 96,
  rolloffFactor: 0.65,
  room: {
    decaySeconds: 2.5,
    preDelaySeconds: 0.04,
    sendGain: 0.5,
    dryGain: 0.7,
    nearCutoffHz: 12000,
    farCutoffHz: 1200,
    farDistanceMeters: 50,
    speechGain: 0.3,
  },
};

test("training budgets reject invalid layers, room and grain scheduling before loading", () => {
  expect(() => validateTrainingAudioParameters(parameters)).not.toThrow();
  for (const invalid of [
    { goal: { ...parameters.goal, grainSizeSeconds: 0.04 } },
    { goal: { ...parameters.goal, overlapSeconds: 0.5 } },
    { goal: { ...parameters.goal, playbackRate: 100 } },
    { goal: { ...parameters.goal, sampleId: "missing" } },
    { goal: { ...parameters.goal, volumeDb: Number.POSITIVE_INFINITY } },
    { referenceDistanceMeters: 0 },
    { maximumDistanceMeters: 1 },
    { samples: [...parameters.samples, ...parameters.samples] },
    { room: { ...parameters.room, decaySeconds: 100 } },
    { room: { ...parameters.room, farCutoffHz: Number.NaN } },
    { room: { ...parameters.room, speechGain: 2 } },
  ])
    expect(() =>
      validateTrainingAudioParameters({ ...parameters, ...invalid }),
    ).toThrow("Invalid or unbounded training audio parameters");
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
        currentTime = 0; paused = true; ended = false; readyState = 2; playbackRate = 1;
        loads = 0; plays = 0;
        constructor(src) { this.src = src; elements.push(this); }
        play() { this.paused = false; this.plays++; return Promise.resolve(); }
        pause() { this.paused = true; }
        removeAttribute(name) { if (name === "src") this.src = ""; }
        load() { this.loads++; }
      }
      globalThis.Audio = Audio;
      globalThis.HTMLMediaElement = { HAVE_METADATA: 1, HAVE_CURRENT_DATA: 2 };
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
      assert.equal(player.readIsPlaying(), true);
      elements[0].ended = true;
      assert.equal(player.readIsPlaying(), false);
      elements[0].ended = false;
      elements[0].readyState = 1;
      assert.equal(player.readIsPlaying(), false);
      elements[0].readyState = 2;
      follow("right", 3, false);
      assert.equal(elements[0].paused, true);
      assert.equal(elements[0].currentTime, 3);
      assert.equal(player.readIsPlaying(), false);
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
      const mainRecording = { cueId: "prologue", url: "/main/prologue.mp3", durationSeconds: 72 };
      player.setRecordings([
        { cueId: "right", url: "/approved/right.wav", durationSeconds: 7 },
        mainRecording,
      ]);
      assert.equal(elements.length, 3, "unchanged recordings retain their preloaded element");
      assert.equal(elements[1].src, "", "removed tutorial recordings release their source");
      const preparedMain = elements[2];
      player.setRecordings([mainRecording]);
      assert.equal(elements.length, 3, "handoff does not allocate or reload main speech");
      assert.equal(preparedMain.loads, 0);
      assert.equal(elements[0].src, "");
      follow("prologue", 0);
      assert.equal(preparedMain.plays, 1);
      player.setRecordings([mainRecording,
        { cueId: "right", url: "/approved/right.wav", durationSeconds: 7 },
      ]);
      assert.equal(elements.length, 4, "restart adds only the retired tutorial recording");
      assert.equal(preparedMain.loads, 0);
      assert.equal(preparedMain.paused, true);
      player.setRecordings([
        { ...mainRecording, url: "/main/de/prologue.mp3" },
        { cueId: "right", url: "/approved/right.wav", durationSeconds: 7 },
      ]);
      assert.equal(elements.length, 5, "a language change replaces only changed URLs");
      assert.equal(preparedMain.src, "");
      assert.equal(preparedMain.loads, 1);
      follow("prologue", 0);
      assert.equal(elements[4].plays, 1);
      player.unload(); player.unload();
      assert.equal(player.readIsPlaying(), false);
      follow("right", 0);
      player.setRecordings([mainRecording]);
      assert.equal(elements.length, 5, "an unloaded owner cannot prepare more clips");
      assert.ok(elements.every(element => element.paused && !element.src && element.loads === 1));

      const { createTrainingAudio } = await import("./src/sound/training-audio.runtime.ts");
      globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
      let finishDecode, createdNodes = 0;
      const cancellation = new AbortController();
      const pending = createTrainingAudio(${JSON.stringify(parameters)}, { context: {
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

test("four object voices share samples and hall, follow distance and speech, and release fully", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import { mock } from "bun:test";
    import assert from "node:assert/strict";
    const voices = [], gains = [], filters = [], placements = [], rooms = [];
    let audioTime = 1;
    const param = () => ({ value: 0, target: 0, events: [],
      cancelScheduledValues(time){this.events=this.events.filter(event=>event.time<time);},
      setTargetAtTime(value,time){this.target=value;this.events.push({time});},
      setValueAtTime(value,time){this.target=value;this.events.push({time});} });
    const node = () => ({ ends:0, gain:param(), connect(){}, disconnect(){this.ends++;} });
    class GrainPlayer {
      starts=0; stops=0; ends=0;
      constructor(options){ this.options=options; voices.push(this); }
      connect(){} start(){this.starts++;} stop(){this.stops++;} dispose(){this.ends++;}
    }
    class Reverb {
      ready=Promise.resolve(); ends=0;
      constructor(){rooms.push(this);} connect(){} dispose(){this.ends++;}
    }
    mock.module("tone",()=>({GrainPlayer, Reverb, connect(){}}));
    let decodes=0;
    const sample={duration:10,numberOfChannels:1,sampleRate:48000};
    globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));
    const {createTrainingAudio}=await import("./src/sound/training-audio.runtime.ts");
    const audio=await createTrainingAudio(${JSON.stringify(parameters)}, {
      context:{ state:"running", now:()=>audioTime+0.1, immediate:()=>audioTime, destination:{},
        decodeAudioData:async()=>{decodes++;return sample;},
        createGain:()=>{const value=node();gains.push(value);return value;},
        createBiquadFilter:()=>{const value={...node(),Q:param(),frequency:param()};filters.push(value);return value;},
      },
      createSource:()=>{const source={ends:0,distance:3,position:null,
        readDistanceMeters(){return this.distance;},
        setPosition(x,y,z){this.position=[x,y,z];},unload(){this.ends++;}};
        placements.push(source);return source;},
    },new AbortController().signal);
    assert.equal(decodes,1);assert.equal(voices.length,4);assert.equal(rooms.length,1);
    assert.ok(voices.every(voice=>voice.options.url===sample));
    const frame={phase:"forming",formationProgress:0.5,goalPosition:{x:0,y:0,z:-8},
      objects:{ringLeft:{x:-3,y:0,z:-8},ringRight:{x:3,y:0,z:-8},arrow:{x:5,y:0,z:-8}}};
    audio.update({...frame,objects:undefined},true);
    assert.ok(voices.every(voice=>voice.starts===0),"absent graphics must not schedule invisible emitters");
    audio.update(frame,true);audio.update(frame,true);
    audio.update({...frame,phase:"crossed",wake:{strength:1}},true);
    assert.equal(voices[3].detune,500,"passage raises only the existing goal voice");
    audio.update({...frame,phase:"missed"},true);
    assert.equal(voices[3].detune,-500,"miss feedback differs from a successful passage");
    audio.update(frame,true);
    assert.equal(voices[3].detune,0,"a recycled goal returns to its steady pitch");
    assert.ok(voices.every(voice=>voice.starts===1));
    assert.deepEqual(placements.map(source=>source.position),[[-3,0,-8],[3,0,-8],[5,0,-8],[0,0,-8]]);
    const nearDirect=gains[1].gain.target,nearSend=gains[2].gain.target;
    placements[0].distance=50;audio.update(frame,true);
    assert.ok(gains[1].gain.target<nearDirect);assert.ok(gains[2].gain.target<nearSend);
    assert.equal(filters[0].frequency.target,1200);
    placements[0].distance=96;audio.update(frame,true);
    const maximumDistanceSend=gains[2].gain.target;
    placements[0].distance=192;audio.update(frame,true);
    assert.ok(gains[2].gain.target<maximumDistanceSend,"diffuse sound must keep attenuating beyond maxDistance like the inverse-distance panner");
    audio.update(frame,true,true);
    assert.equal(gains[0].gain.target,0.3,"existing hall tails duck with speech");
    assert.ok(gains[1].gain.target<nearDirect*0.3);
    audio.update(frame,false);
    assert.ok(voices.every(voice=>voice.stops===1));
    assert.ok(gains.every(gain=>gain.gain.target===0),"pause mutes direct sound, sends and hall tails immediately");
    audio.update(frame,true);assert.ok(voices.every(voice=>voice.starts===2));
    frame.phase="crossed";frame.formationProgress=0;
    for(let i=0;i<100;i++)audio.update(frame,true);
    assert.ok(voices.every(voice=>voice.stops===2&&voice.starts===2),"dissolved objects do not schedule silent grains during speech holds");
    for(let frameIndex=0;frameIndex<3600;frameIndex++){
      audioTime+=1/60;
      for(const placement of placements)placement.distance=10+frameIndex*0.1;
      audio.update({...frame,phase:"flying",formationProgress:1},true);
      for(const parameter of [...gains.map(gain=>gain.gain),...filters.map(filter=>filter.frequency)])
        assert.ok(parameter.events.length<=2,"live parameter history remains bounded during continued flight");
    }
    audio.unload();audio.unload();audio.update(frame,true);
    assert.ok([...voices,...gains,...filters,...placements,...rooms].every(resource=>resource.ends===1));
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(await probe.exited).toBe(0);
});

test("sample limits, pending room cancellation and partial startup release owned resources", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import {mock} from "bun:test";
    import assert from "node:assert/strict";
    let finishRoom, roomEnds=0, nodes=0, decoded=0, placements=0, ends=0;
    class Reverb {
      constructor(){this.ready=new Promise(resolve=>{finishRoom=resolve;});}
      connect(){} dispose(){roomEnds++;}
    }
    class GrainPlayer {connect(){} dispose(){ends++;}}
    mock.module("tone",()=>({Reverb,GrainPlayer,connect(){}}));
    let sample={duration:12,numberOfChannels:1,sampleRate:48000};
    const param=()=>({value:0});
    const node=()=>{nodes++;return {gain:param(),Q:param(),connect(){},disconnect(){ends++;}};};
    const context={decodeAudioData:async()=>{decoded++;return sample;},
      createGain:node,createBiquadFilter:node,destination:{}};
    const spatial={context,createSource(){placements++;throw new Error("placement failed");}};
    const {createTrainingAudio}=await import("./src/sound/training-audio.runtime.ts");
    const parameters=${JSON.stringify(parameters)};
    globalThis.fetch=async()=>new Response(new Uint8Array(2_000_001));
    await assert.rejects(createTrainingAudio(parameters,spatial,new AbortController().signal),/byte capacity/);
    assert.equal(decoded,0,"oversize streams never reach the decoder");
    globalThis.fetch=async()=>new Response(new Uint8Array([1]));
    for(const invalid of [
      {duration:21,numberOfChannels:1,sampleRate:48000},
      {duration:12,numberOfChannels:2,sampleRate:48000},
      {duration:12,numberOfChannels:1,sampleRate:192000},
    ]) {
      sample=invalid;
      await assert.rejects(createTrainingAudio(parameters,spatial,new AbortController().signal),/bounded mono/);
    }
    assert.equal(nodes,0);assert.equal(roomEnds,0);
    sample={duration:12,numberOfChannels:1,sampleRate:48000};
    const cancellation=new AbortController();
    const pending=createTrainingAudio(parameters,spatial,cancellation.signal);
    const failure=assert.rejects(pending,error=>error.name==="AbortError");
    while(!finishRoom)await new Promise(resolve=>setTimeout(resolve,0));
    cancellation.abort();
    assert.equal(roomEnds,0,"offline IR publication finishes before its owner is released");
    finishRoom();await failure;
    assert.equal(roomEnds,1);assert.equal(nodes,0);assert.equal(placements,0);
    finishRoom=undefined;
    const partial=createTrainingAudio(parameters,spatial,new AbortController().signal);
    const partialFailure=assert.rejects(partial,/placement failed/);
    while(!finishRoom)await new Promise(resolve=>setTimeout(resolve,0));
    finishRoom();await partialFailure;
    assert.equal(roomEnds,2);assert.equal(nodes,4);assert.equal(ends,5);
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(await probe.exited).toBe(0);
});

test("production tutorial ships every German instruction with its original bytes and measured duration", async () => {
  const recordings = level.startNarration?.de ?? [];
  expect(recordings.map((recording) => recording.cueId)).toEqual([
    "right",
    "left",
    "up",
    "down",
    "complete",
  ]);
  const provenance: {
    files: {
      file: string;
      durationSeconds: number;
      bytes: number;
      sha256: string;
    }[];
  } = await Bun.file(
    new URL("../../public/audio/tutorial/provenance.json", import.meta.url),
  ).json();
  for (const recording of recordings) {
    const source = provenance.files.find(
      (clip) => `/audio/tutorial/${clip.file}` === recording.url,
    );
    if (!source) throw new Error(`Missing provenance for ${recording.url}`);
    expect(recording.durationSeconds).toBe(source.durationSeconds);
    const bytes = await Bun.file(
      new URL(`../../public${recording.url}`, import.meta.url),
    ).arrayBuffer();
    expect(bytes.byteLength).toBe(source.bytes);
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(
      source.sha256,
    );
  }
});
