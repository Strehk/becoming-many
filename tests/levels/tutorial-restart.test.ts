import { expect, test } from "bun:test";

// Isolate module mocks so real Composition remains intact for every other suite.
test("Run restarts tutorial across phases and owns pending restart cleanup", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
      import { mock } from "bun:test";
      import assert from "node:assert/strict";
      import { ModuleRuntime } from "./src/world/module-runtime.ts";
      const modules = [], worlds = [], audioOwners = [];
      let frame, resetCount = 0, tutorialLoads = 0, gate;
      const tick = () => new Promise(resolve => setTimeout(resolve, 0));
      const createModule = name => {
        const module = { name, active: false, loads: 0, ends: 0,
          load(){this.loads++;}, activate(){this.active=true;},
          deactivate(){this.active=false;}, unload(){this.ends++;} };
        modules.push(module);
        return module;
      };
      const createComposition = tutorial => {
        const module = createModule(tutorial ? "tutorial" : "main");
        return { modules: [module], worldSurface: {}, reach: {}, hasGround: false,
          tutorial: tutorial ? {
            readProgress: () => ({completedChunks:0,totalChunks:4,phase:"active"}),
            readComplete: () => false, setPresence() {},
            setPaused(value){module.paused=value;},
            readPlayback:()=>module.paused ? "paused" : "playing",
          } : undefined,
          voice: {unload(){module.voiceEnded=true;}},
        };
      };
      let showTime = 0, playing = false, language = "en";
      const tutorialLanguages = [];
      const running = {
        readLanguage: () => language,
        sample:()=>({timeSeconds:showTime,isPlaying:playing}),
        togglePlayback(){playing=!playing;},
        resetTime(){showTime=0;playing=false;}, seekTo(time){showTime=time;},
        play(){playing=true;}, pause(){playing=false;},
      };
      let audioFollowing = false;
      mock.module("./src/levels/level-composition.ts", () => ({
        loadLevelAssets: async level => {
          if(level.tutorial) tutorialLoads++;
          return {};
        },
        composeWorld: () => {
          const world = { camera:{fov:50,updateProjectionMatrix(){}},
            renderer:{setClearColor(){},xr:{isPresenting:false}}, xr:{},
            modules:new ModuleRuntime(), prepareRenderer:async()=>{},
            start(callback){frame=callback;}, stop(){frame=undefined;},
            unload(){this.ends=(this.ends??0)+1;if(this.failEnd)throw new Error("world cleanup failed");},
          };
          worlds.push(world);
          return world;
        },
        composeControls: () => ({ resetRig(){resetCount++;},
          flight:{update(){}}, constrainHeight(){} }),
        composeLevel: async ({level, language}) => {
          if(level.tutorial) tutorialLanguages.push(language);
          if(level.tutorial && gate) await gate.promise;
          return createComposition(level.tutorial);
        },
        composePlayback: async () => {
          const audio = { context:{state:"running"}, update(){},
            unload(){this.context.state="closed";} };
          audioOwners.push(audio);
          return {audio, playback:{ running,
            update(){audioFollowing=playing;},
            readActiveLevelState:()=>({}),unload:async()=>{audioFollowing=false;},
          }};
        },
      }));
      mock.module("./src/dramaturgy/show-levels.ts", () => ({showLevelStateAt:()=>({})}));
      const { startLevel } = await import("./src/levels/level.runtime.ts");
      const request = {kind:"show",preset:{},tutorial:{tutorial:true},show:{schedule:{durationSeconds:900}}};
      const run = await startLevel({}, request);
      assert.deepEqual(tutorialLanguages, ["en"]);
      const availability = [];
      run.subscribeShow(show => availability.push(!!show));
      assert.equal(run.show,undefined);
      assert.equal(run.readTutorial().phase,"active");
      assert.equal(modules.filter(m=>m.active).length,1);
      const firstTutorial=modules.at(-1);
      run.skipTutorial(120);
      frame(0.5);
      assert.equal(run.readTutorial().phase,"transition");
      language = "de";
      run.resetShowAndFlight();
      assert.equal(firstTutorial.ends,1);
      assert.equal(firstTutorial.voiceEnded,true);
      assert.equal(run.readTutorial().phase,"loading");
      await tick();
      assert.equal(run.readTutorial().phase,"active");
      frame(4);
      assert.equal(run.show,undefined,"old skip cannot finish a fresh tutorial");
      assert.equal(tutorialLoads,2);
      assert.deepEqual(tutorialLanguages, ["en", "de"]);

      run.skipTutorial(120);
      frame(3);
      assert.equal(run.show,running);
      assert.equal(showTime,120);
      assert.equal(playing,true);
      const secondTutorial=modules.at(-1);
      assert.equal(secondTutorial.ends,1);
      frame(0.1);
      assert.equal(audioFollowing,true);
      gate=Promise.withResolvers();
      run.resetShowAndFlight();
      run.resetShowAndFlight();
      assert.equal(showTime,0);
      assert.equal(playing,false);
      assert.equal(audioFollowing,false,"main audio follows stopped state before tutorial rebuild");
      assert.equal(run.show,undefined);
      assert.equal(availability.at(-1),false);
      await tick();
      assert.equal(tutorialLoads,3,"repeated Stop coalesces one pending composition");
      assert.equal(modules.filter(m=>m.active).length,0,"main world hidden while rebuilding");
      gate.resolve();
      await tick();
      gate=undefined;
      assert.equal(run.readTutorial().phase,"active");
      assert.equal(run.readTutorial().completedChunks,0);
      assert.equal(run.readPlayback(),"paused");
      run.togglePlayback();
      assert.equal(run.readPlayback(),"playing");
      run.togglePlayback();
      assert.equal(run.readPlayback(),"paused");
      assert.equal(worlds.length,1);
      assert.equal(audioOwners.length,1);
      assert.equal(audioOwners[0].context.state,"running");
      assert.deepEqual(availability,[false,false,true,false]);

      gate=Promise.withResolvers();
      run.resetShowAndFlight();
      await tick();
      let ended=false;
      const ending=run.unload().then(()=>{ended=true;});
      await tick();
      assert.equal(ended,false,"unload awaits late composition before releasing shared owners");
      assert.equal(run.show,undefined);
      assert.equal(run.readTutorial(),undefined);
      gate.resolve();
      await ending;
      await tick();
      assert.equal(worlds[0].ends,1);
      assert.equal(audioOwners[0].context.state,"closed");
      assert.ok(modules.every(module=>module.ends===1));
      assert.ok(modules.every(module=>!module.active));
      assert.equal(modules.at(-1).voiceEnded,true);
      const loadsBeforeEnd=tutorialLoads;
      run.resetShowAndFlight();
      assert.equal(tutorialLoads,loadsBeforeEnd);
      await run.unload();
      assert.equal(worlds[0].ends,1);

      gate=undefined;
      const plain = await startLevel({}, {...request,tutorial:undefined});
      running.seekTo(80);running.play();
      plain.resetShowAndFlight();
      assert.equal(plain.show,running,"shows without a tutorial retain normal rewind behavior");
      assert.equal(showTime,0);assert.equal(playing,false);
      await plain.unload();
      assert.ok(resetCount>=4);

      const failed = await startLevel({},request);
      gate=Promise.withResolvers();
      const reported=[];
      const report=console.error;
      console.error=(message)=>reported.push(message);

      failed.resetShowAndFlight();
      await tick();
      gate.reject(new Error("tutorial construction failed"));
      await tick();
      await tick();
      console.error=report;
      assert.deepEqual(reported,["Tutorial restart failed"]);
      assert.equal(failed.readAudioState(),"running");
      assert.equal(worlds.at(-1).ends,undefined);
      assert.equal(failed.readPlayback(),"error");
      assert.equal(failed.readTutorial().phase,"error");
      assert.equal(failed.show,undefined);
      gate=undefined;
      failed.togglePlayback();
      await tick();
      assert.equal(failed.readPlayback(),"paused");
      failed.togglePlayback();
      assert.equal(failed.readPlayback(),"playing");
      await failed.unload();
    `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});
