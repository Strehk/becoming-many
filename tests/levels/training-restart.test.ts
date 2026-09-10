import { expect, test } from "bun:test";

test("Run gates training preparation and releases failed or cancelled restart children", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
      import { mock } from "bun:test";
      import assert from "node:assert/strict";
      import { Group, PerspectiveCamera } from "three";
      import { ModuleRuntime } from "./src/world/module-runtime.ts";
      const turn = () => new Promise(resolve => setTimeout(resolve, 0));
      const modules = [], audioRequests = [], graphicsRequests = [], voices = [];
      let deferGraphics = false;
      let failLoad = false, trainingCount = 0, audioCount = 0;
      let sharedEnds = 0, worldEnds = 0, resets = 0;
      let show, frame;
      const rig = new Group(), camera = new PerspectiveCamera();
      const makeModule = (name, failure = false) => {
        const module = {
          name, loads: 0, ends: 0,
          load() { this.loads++; if (failure) throw new Error("training load failed"); },
          activate() {}, deactivate() {},
          unload() { this.ends++; },
        };
        modules.push(module); return module;
      };
      const makeTraining = () => {
        trainingCount++;
        const background = makeModule("background-" + trainingCount);
        const target = makeModule("target-" + trainingCount, failLoad);
        return {
          start: { resetPractice() { resets++; }, setPlaying() {}, readObservation: () => ({phase:"arrival"}) },
          modules: [background, target],
        };
      };
      const voice = () => {
        const created = { ends:0, releasing:false, released:false, resets:0, reset(){this.resets++;}, update() {}, beginRelease(){this.releasing=true;}, updateRelease(){return this.released;}, unload() { this.ends++; } };
        voices.push(created); return created;
      };
      const main = makeModule("main");
      mock.module("./src/levels/level-composition.ts", () => ({
        loadLevelAssets: async () => ({}),
        composeLevel: async () => {
          const training = makeTraining();
          return { start:training.start, trainingModules:training.modules,
            modules:[main,...training.modules], worldSurface:{groundYAt:()=>100}, reach:{}, hasGround:true };
        },
        composeTraining: makeTraining,
      }));
      mock.module("./src/world/world-runtime.ts", () => ({
        createWorld: () => ({
          camera, viewerRig:rig,
          renderer:{setClearColor(){},domElement:{}}, modules:new ModuleRuntime(),
          prepareRenderer:()=>deferGraphics
            ? new Promise((resolve,reject)=>graphicsRequests.push({resolve,reject}))
            : Promise.resolve(),
          start(update){frame=update;}, stop:async()=>{},
          unload:async()=>{worldEnds++;}, readGraphicsInfo(){}, renderCounters:{}, xr:{},
        }),
      }));
      mock.module("./src/control/desktop-controls.runtime.ts", () => ({
        createDesktopControls: () => ({update(){},unload(){}}),
      }));
      mock.module("./src/m5/runtime/m5.runtime.ts", () => ({
        createM5Runtime: () => ({consumeFrame(){},unload(){}}),
      }));
      mock.module("./src/sound/spatial-audio.runtime.ts", () => ({
        createSpatialAudio: async () => ({update(){},unload:async()=>{sharedEnds++;}}),
      }));
      mock.module("./src/sound/training-audio.runtime.ts", () => ({
        createTrainingAudio: (parameters,audio,signal) => {
          audioCount++;
          if(audioCount===1) return Promise.resolve(voice());
          return new Promise((resolve,reject)=>audioRequests.push({resolve,reject,signal}));
        },
      }));
      mock.module("./src/levels/show.runtime.ts", () => ({
        createShowRuntime: async (...args) => {
          show = {
            state:"ready", tutorial:args[1].tutorial, stateWrites:[], update(){}, readSpeechActive:()=>false,
            setTutorial(tutorial){this.tutorial=tutorial;},
            setPreparationState(state){this.state=state;this.stateWrites.push(state);if(state==="failed")this.tutorial=undefined;},
            unload:async()=>{show.tutorial=undefined;},
            finish(){const tutorial=this.tutorial;this.tutorial=undefined;tutorial.finish();},
            readActiveLevelState:()=>({}),
            running:{resetTime(){show.tutorial?.reset();},readTutorial:()=>show.tutorial,sample:()=>({isPlaying:false})},
          };
          return show;
        },
      }));
      console.error = () => {};
      const { startLevel } = await import("./src/levels/level.runtime.ts");
      const { PIECE_SCHEDULE } = await import("./src/dramaturgy/piece-schedule.ts");
      const { SHOW_LEVEL_STATES } = await import("./src/dramaturgy/show-levels.ts");
      const request = {
        kind:"show", preset:{backgroundColor:0xffffff,viewDistance:128},
        show:{schedule:PIECE_SCHEDULE,states:SHOW_LEVEL_STATES,language:"en"},
        tutorial:{backgroundColor:0xffffff,viewDistance:128,desktopFieldOfViewDegrees:80,start:{directions:["right"]},startAudio:{}},
      };
      const run = await startLevel({}, request);
      deferGraphics = true;
      assert.equal(camera.fov,80,"training keeps level goals visible below the assisted view");
      frame(0.1);
      assert.equal(rig.position.y,0,"prepared invisible terrain cannot block Start goals");
      const audioResets=voices[0].resets;
      const practiceResets = resets;
      run.resetShowAndFlight();
      assert.equal(resets,practiceResets+1,"combined reset reaches Start exactly once");
      assert.equal(voices[0].resets,audioResets+1,"a retained tutorial audio owner resets with the flight and visual lesson");
      show.finish();
      frame(0.1);
      assert.equal(camera.fov,50,"handoff restores the original main projection");
      assert.equal(rig.position.y,101,"main ground clearance resumes after handoff");
      assert.equal(voices[0].ends,0,"handoff retains the owned audio tail");
      assert.equal(voices[0].releasing,true);
      assert.equal(main.ends,0);assert.equal(sharedEnds,0);
      run.resetShowAndFlight();
      assert.equal(show.state,"loading");assert.equal(audioRequests.length,0);
      assert.equal(graphicsRequests.length,1);
      assert.equal(camera.fov,80,"recreated training restores its own projection");
      const resetting = resets;
      run.resetShowAndFlight();
      assert.ok(resets>resetting);assert.equal(graphicsRequests.length,1);
      assert.equal(show.state,"loading","reset must not release the preparation gate");
      graphicsRequests[0].resolve();await turn();
      assert.equal(audioRequests.length,0,"restart waits for the previous spatial pool to drain");
      voices[0].released=true;frame(0.1);await turn();
      assert.equal(voices[0].ends,1);
      assert.equal(show.state,"loading","graphics readiness still waits for the sample");
      const prepared=voice();audioRequests[0].resolve(prepared);await turn();
      assert.equal(show.state,"ready");
      show.finish();assert.equal(prepared.ends,0);prepared.released=true;frame(0.1);assert.equal(prepared.ends,1);assert.equal(sharedEnds,0);
      failLoad=true;
      run.resetShowAndFlight();
      assert.equal(show.state,"failed");assert.equal(show.tutorial,undefined);
      assert.equal(modules.at(-2).ends,1);assert.equal(modules.at(-1).ends,1);
      assert.equal(audioRequests.length,1,"failed synchronous loading never starts sample preparation");
      failLoad=false;
      run.resetShowAndFlight();
      assert.equal(show.state,"loading");
      graphicsRequests[1].resolve();await turn();assert.equal(audioRequests.length,2);
      audioRequests[1].reject(new Error("sample decode failed"));await turn();
      assert.equal(show.state,"failed");assert.equal(show.tutorial,undefined);
      assert.equal(modules.at(-2).ends,1);assert.equal(modules.at(-1).ends,1);
      assert.equal(main.ends,0);assert.equal(sharedEnds,0);
      run.resetShowAndFlight();
      assert.equal(show.state,"loading");
      graphicsRequests[2].resolve();await turn();assert.equal(audioRequests.length,3);
      const writesBeforeEnd=show.stateWrites.length;
      const ending=run.unload();await turn();
      assert.equal(audioRequests[2].signal.aborted,true);assert.equal(sharedEnds,0);
      const late=voice();audioRequests[2].resolve(late);await ending;
      assert.equal(late.ends,1);assert.equal(show.stateWrites.length,writesBeforeEnd);
      assert.equal(sharedEnds,1);assert.equal(worldEnds,1);assert.equal(main.ends,1);
      assert.ok(modules.every(module=>module.ends===1),"every allocated training lifetime ends exactly once");
      const creationsAfterEnd=trainingCount;
      run.resetShowAndFlight();
      assert.equal(trainingCount,creationsAfterEnd,"ended Runs cannot recreate training children");

      // Silent production training needs the same graphics gate and cancellation.
      deferGraphics = false;
      delete request.tutorial.startAudio;
      const silent = await startLevel({},request);
      deferGraphics = true;
      show.finish();silent.resetShowAndFlight();
      assert.equal(show.state,"loading");assert.equal(graphicsRequests.length,4);
      graphicsRequests[3].reject(new Error("shader compilation failed"));await turn();
      assert.equal(show.state,"failed");assert.equal(show.tutorial,undefined);
      assert.equal(modules.at(-2).ends,1);assert.equal(modules.at(-1).ends,1);
      silent.resetShowAndFlight();assert.equal(show.state,"loading");
      graphicsRequests[4].resolve();await turn();
      assert.equal(show.state,"ready");assert.equal(audioRequests.length,3);
      show.finish();silent.resetShowAndFlight();
      const silentWrites=show.stateWrites.length;
      const silentEnding=silent.unload();await turn();
      assert.equal(modules.at(-2).ends,0,"pending graphics retain their children until settled");
      assert.equal(modules.at(-1).ends,0);
      graphicsRequests[5].resolve();await silentEnding;
      assert.equal(modules.at(-2).ends,1);assert.equal(modules.at(-1).ends,1);
      assert.equal(show.stateWrites.length,silentWrites,"late graphics cannot publish ready");
      assert.equal(audioRequests.length,3,"silent restarts create no audio sources");
      `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});
