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
    {
      effects: {
        wind: { url: "", volumeDb: -20 },
        passage: { url: "/whoosh.wav", volumeDb: -12 },
      },
    },
    {
      effects: {
        wind: { url: "/wind.wav", volumeDb: 1 },
        passage: { url: "/whoosh.wav", volumeDb: -12 },
      },
    },
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
      linearRampToValueAtTime(value,time){this.target=value;this.events.push({time});},
      setTargetAtTime(value,time){this.target=value;this.events.push({time});},
      setValueAtTime(value,time){this.target=value;this.events.push({time});} });
    const node = () => ({ ends:0, gain:param(), connect(){}, disconnect(){this.ends++;} });
    class GrainPlayer {
      starts=0; stops=0; ends=0; buffers=[]; offsets=[];
      buffer={set:sample=>{this.buffers.push(sample);}};
      constructor(options){ this.options=options; voices.push(this); }
      connect(){} start(time,offset){this.starts++;this.offsets.push(offset);} stop(){this.stops++;} dispose(){this.ends++;}
    }
    class Reverb {
      ready=Promise.resolve(); ends=0;
      constructor(){rooms.push(this);} connect(){} dispose(){this.ends++;}
    }
    mock.module("tone",()=>({GrainPlayer, Reverb, connect(){}}));
    let decodes=0, randomCalls=0;
    const samples=[10,11,12].map(duration=>({duration,numberOfChannels:1,sampleRate:48000}));
    globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));
    const {createTrainingAudio}=await import("./src/sound/training-audio.runtime.ts");
    const parameters=${JSON.stringify(parameters)};
    parameters.samples.push({id:"b",url:"/audio/b.wav"},{id:"c",url:"/audio/c.wav"});
    const audio=await createTrainingAudio(parameters, {
      context:{ state:"running", now:()=>audioTime+0.1, immediate:()=>audioTime, destination:{},
        decodeAudioData:async()=>samples[decodes++],
        createGain:()=>{const value=node();gains.push(value);return value;},
        createBiquadFilter:()=>{const value={...node(),Q:param(),frequency:param()};filters.push(value);return value;},
      },
      createSource:()=>{const source={ends:0,distance:3,position:null,
        readDistanceMeters(){return this.distance;},
        setPosition(x,y,z){this.position=[x,y,z];},unload(){this.ends++;}};
        placements.push(source);return source;},
    },new AbortController().signal,()=>{randomCalls++;return (randomCalls%7)/7;});
    assert.equal(decodes,3);assert.equal(voices.length,4);assert.equal(rooms.length,1);
    assert.ok(voices.every(voice=>voice.options.url===samples[0]));
    const frame={goalIndex:0,attempt:0,phase:"forming",formationProgress:0.5,goalPosition:{x:0,y:0,z:-8},
      objects:{ringLeft:{x:-3,y:0,z:-8},ringRight:{x:3,y:0,z:-8},arrow:{x:5,y:0,z:-8}}};
    audio.update({...frame,objects:undefined},true);
    assert.ok(voices.every(voice=>voice.starts===0),"absent graphics must not schedule invisible emitters");
    audio.update({...frame,phase:"turning",formationProgress:0,arrowFormationProgress:0.5},true);
    assert.deepEqual(voices.map(voice=>voice.starts),[0,0,1,0],"only the visible arrow emits before the turn");
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
    assert.ok(voices.every(voice=>voice.stops===0),"pause ramps before stopping the grain clock");
    audioTime+=0.1; audio.update(frame,false);
    assert.ok(voices.every(voice=>voice.stops===1));
    assert.ok(gains.every(gain=>gain.gain.target===0),"pause targets silence for direct sound, sends and hall with a click-free ramp");
    audio.update(frame,true);assert.ok(voices.every(voice=>voice.starts===2));
    assert.equal(randomCalls,6,"pause, speech, distance and repeated frames do not choose another sound");
    for(const voice of [voices[0],voices[1],voices[3]])
      assert.equal(voice.offsets[0],voice.offsets[1],"resume retains the course offset");
    frame.phase="crossed";frame.formationProgress=0;
    for(let i=0;i<100;i++){audioTime+=1/60;audio.update(frame,true);}
    assert.ok(voices.every(voice=>voice.stops===2&&voice.starts===2),"dissolved objects do not schedule silent grains during speech holds");
    for(let frameIndex=0;frameIndex<3600;frameIndex++){
      audioTime+=1/60;
      for(const placement of placements)placement.distance=10+frameIndex*0.1;
      audio.update({...frame,phase:"flying",formationProgress:1},true);
      for(const parameter of [...gains.map(gain=>gain.gain),...filters.map(filter=>filter.frequency)])
        assert.ok(parameter.events.length<=2,"live parameter history remains bounded during continued flight");
    }
    assert.equal(randomCalls,6,"steady flight does not run random selection");
    frame.phase="forming";frame.formationProgress=0.5;
    for(let course=1;course<=100;course++){
      frame.goalIndex=Math.floor(course/5);frame.attempt=course%5;
      const oldPosition=[...placements[0].position];
      audio.update(frame,true);
      assert.deepEqual(placements[0].position,oldPosition,"retiring source remains at its prior world anchor");
      audioTime+=1.3;audio.update(frame,true);
      for(const voice of [voices[0],voices[1],voices[3]]){
        const previous=voice.buffers.at(-2),current=voice.buffers.at(-1);
        assert.notEqual(current,previous,"each new goal or retry changes sample");
        assert.ok(samples.includes(current),"only the three predecoded buffers are reused");
        const offset=voice.offsets.at(-1);
        const span=(voice.options.grainSize/voice.options.playbackRate+voice.options.overlap)*
          2**((voice.options.detune+(voice===voices[3]?500:0))/1200);
        assert.ok(offset>=0&&offset+span<=current.duration,"random offsets fit a full grain and its tail");
      }
    }
    assert.equal(voices[2].buffers.length,0,"arrow keeps its authored sound");
    assert.equal(decodes,3);assert.equal(voices.length,4);assert.equal(rooms.length,1);
    assert.equal(gains.length,9);assert.equal(filters.length,4);assert.equal(placements.length,4);
    const startsBeforeRelease=voices.map(voice=>voice.starts);
    const positionsBeforeRelease=placements.map(source=>[...source.position]);
    audio.beginRelease();audio.beginRelease();
    assert.equal(audio.updateRelease(true),false);
    audio.update({...frame,goalPosition:{x:999,y:999,z:999}},true);
    assert.deepEqual(placements.map(source=>source.position),positionsBeforeRelease,"handoff tail stays in the departed world");
    audioTime+=1.3;assert.equal(audio.updateRelease(true),false,"the hall outlives its input voices");
    assert.deepEqual(voices.map(voice=>voice.starts),startsBeforeRelease);
    audioTime+=2.8;assert.equal(audio.updateRelease(true),true,"handoff tail has a four-second resource bound");
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

test("optional wind and passage effects reuse two players, duck, pause without replay and dispose", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import {mock} from "bun:test";
    import assert from "node:assert/strict";
    const players=[], grains=[], gains=[], filters=[], placements=[], rooms=[];
    let now=1, decodes=0;
    const param=()=>({value:0,target:0,events:[],
      cancelScheduledValues(time){this.events=this.events.filter(event=>event.time<time);},
      linearRampToValueAtTime(value,time){this.target=value;this.events.push({time});},
      setTargetAtTime(value,time){this.target=value;this.events.push({time});},
      setValueAtTime(value,time){this.target=value;this.events.push({time});}});
    const node=()=>({ends:0,gain:param(),connect(){},disconnect(){this.ends++;}});
    class Player {
      starts=0; stops=0; ends=0; offsets=[]; startTimes=[]; stopTimes=[];
      constructor(options){this.options=options;players.push(this);}
      connect(){} start(time,offset){this.starts++;this.offsets.push(offset);this.startTimes.push(time);} stop(time){this.stops++;this.stopTimes.push(time);} dispose(){this.ends++;}
    }
    class GrainPlayer {
      buffer={set(){}}; ends=0;
      constructor(){grains.push(this);} connect(){} start(){} stop(){} dispose(){this.ends++;}
    }
    class Reverb {ready=Promise.resolve();ends=0;
      constructor(){rooms.push(this);}connect(){}dispose(){this.ends++;}}
    mock.module("tone",()=>({Player,GrainPlayer,Reverb,connect(){}}));
    globalThis.fetch=async()=>new Response(new Uint8Array([1]));
    const context={state:"running",destination:{},immediate:()=>now,now:()=>now+0.1,
      decodeAudioData:async()=>({duration:++decodes%3===0?0.25:12,numberOfChannels:1,sampleRate:48000}),
      createGain:()=>{const value=node();gains.push(value);return value;},
      createBiquadFilter:()=>{const value={...node(),frequency:param(),Q:param()};filters.push(value);return value;}};
    const spatial={context,createSource(){const source={ends:0,distance:3,position:[],
      setPosition(x,y,z){this.position=[x,y,z];},readDistanceMeters(){return this.distance;},unload(){this.ends++;}};
      placements.push(source);return source;}};
    const {createTrainingAudio}=await import("./src/sound/training-audio.runtime.ts");
    const parameters=${JSON.stringify(parameters)};
    parameters.effects={wind:{url:"/wind.wav",volumeDb:-18},passage:{url:"/whoosh.wav",volumeDb:-12}};
    const audio=await createTrainingAudio(parameters,spatial,new AbortController().signal);
    assert.equal(decodes,3);assert.equal(players.length,2);assert.equal(placements.length,5);assert.equal(rooms.length,1);
    const [wind,passage]=players;
    assert.equal(wind.options.loop,true);assert.equal(passage.options.loop,false);
    assert.equal(wind.options.context,context);assert.equal(passage.options.context,context);
    const frame={goalIndex:0,attempt:0,phase:"arrival",formationProgress:0,arrowFormationProgress:0,
      passageCount:0,passagePosition:{x:0,y:0,z:-10},goalPosition:{x:0,y:0,z:-20},
      objects:{ringLeft:{x:-3,y:0,z:-20},ringRight:{x:3,y:0,z:-20},arrow:{x:5,y:0,z:-20}}};
    const update=(playing=true,speech=false,delta=0.1)=>{now+=delta;audio.update(frame,playing,speech);};
    update();assert.equal(wind.starts,0,"wind waits until the scene reveals a visible body");
    frame.phase="turning";frame.arrowFormationProgress=0.4;
    update();assert.equal(wind.starts,1);
    update();assert.equal(wind.starts,1,"loop does not restart on steady frames");
    frame.passageCount=1;update();
    assert.equal(passage.starts,1);assert.deepEqual(placements[4].position,[0,0,-10]);
    frame.passagePosition.z=-90;update();
    assert.deepEqual(placements[4].position,[0,0,-10],"a playing passage remains at the copied world location");
    update(true,true);assert.equal(gains[9].gain.target,0.3);assert.equal(gains[10].gain.target,0.3*0.7);
    update(false);assert.equal(wind.stops,1);assert.equal(passage.stops,1);
    assert.ok(gains.every(gain=>gain.gain.target===0),"pause smoothly targets silence on all outputs including the shared hall");
    frame.passageCount=2;update(false,false,0.01);update(true,false,0.01);
    assert.ok(wind.startTimes[1]>wind.stopTimes[0],"rapid resume starts after the pending fade-stop instead of being cancelled by it");
    assert.equal(wind.starts,2);assert.equal(passage.starts,1,"events while paused are consumed without replay");
    assert.ok(wind.offsets[1]>0,"wind resumes at its retained loop position");
    frame.phase="missed";frame.passageCount=3;update();assert.equal(passage.starts,1,"misses cannot trigger success effects");
    frame.phase="flying";frame.formationProgress=1;
    frame.passageCount=6;update();assert.equal(passage.starts,2,"multiple crossings in one frame coalesce into one effect");
    frame.passageCount=7;update();assert.equal(passage.starts,2,"close hits keep the audible source fixed instead of truncating it");
    now+=0.3;frame.passageCount=8;update();assert.equal(passage.starts,3);assert.equal(passage.stops,1,"natural sample endings need no forced stop");
    placements[4].distance=20;update();const nearSend=gains[11].gain.target;
    placements[4].distance=200;update();assert.ok(gains[11].gain.target<nearSend);
    frame.passageCount=0;update();assert.equal(passage.starts,3,"reset establishes a new event baseline");
    for(let index=1;index<=200;index++){
      frame.passageCount=index;placements[4].distance=3+index;update();
      for(const gain of gains)assert.ok(gain.gain.events.length<=2,"automation histories stay bounded");
    }
    assert.equal(players.length,2);assert.equal(decodes,3);assert.equal(gains.length,12);assert.equal(placements.length,5);
    frame.phase="complete";frame.objects=undefined;update();
    assert.equal(wind.stops,1,"quiet wind continues while the earned closing narration finishes");
    now+=14;update();assert.equal(wind.stops,1);
    assert.equal(audio.updateRelease(true),false,"completion does not retire the owner before Run handoff");
    audio.reset();
    frame.phase="arrival";frame.formationProgress=0;frame.arrowFormationProgress=0;frame.passageCount=0;
    update();assert.equal(wind.stops,2,"reset retires the retained loop instead of replaying it in the empty opening");
    assert.equal(gains[9].gain.target,0,"the wind gain fades before its scheduled stop even when playback remains active");
    const startsAfterReset=wind.starts;
    now+=10;update();assert.equal(wind.starts,startsAfterReset,"the reveal latch belongs to one practice run");
    frame.phase="turning";frame.arrowFormationProgress=0.4;update();
    assert.equal(wind.starts,startsAfterReset+1,"the next visible cue can reveal the retained wind again");
    audio.beginRelease();assert.equal(wind.stops,3);
    assert.equal(audio.updateRelease(true),false);now+=4.1;assert.equal(audio.updateRelease(true),true);
    audio.unload();audio.unload();update();
    assert.ok([...players,...grains,...gains,...filters,...placements,...rooms].every(resource=>resource.ends===1));
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(await probe.exited).toBe(0);
});
