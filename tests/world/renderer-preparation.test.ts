import { expect, test } from "bun:test";

test("World repeats preparation while holding frames and restoring offscreen state", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
      import { mock } from "bun:test";
      import assert from "node:assert/strict";
      import * as THREE from "three";
      const compileRequests = [], deltas = [], ticks = [];
      const xrListeners = new Map();
      const originalTarget = {};
      let target = originalTarget, face = 2, mip = 3, loop;
      let renders = 0, targetEnds = 0, rendererEnds = 0, contextEnds = 0;
      let failRender = false;
      const renderer = {
        xr:{enabled:true,isPresenting:false,
          addEventListener(name,listener){xrListeners.set(name,listener);},
          removeEventListener(name){xrListeners.delete(name);}}, info:{render:{}},
        compileAsync:()=>new Promise((resolve,reject)=>compileRequests.push({resolve,reject})),
        getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,
        setRenderTarget(next,nextFace=0,nextMip=0){target=next;face=nextFace;mip=nextMip;},
        setAnimationLoop(next){loop=next;},setSize(){},
        render(scene){
          renders++;
          if(target!==originalTarget){
            assert.equal(this.xr.enabled,false);
            scene.traverse(object=>{assert.equal(object.visible,true);assert.equal(object.frustumCulled,false);});
            if(failRender)throw new Error("warmup failed");
          }
        },
        dispose(){rendererEnds++;},forceContextLoss(){contextEnds++;},
      };
      mock.module("three",()=>({
        ...THREE,
        WebGLRenderer:class { constructor(){return renderer;} },
        WebGLRenderTarget:class { texture={}; dispose(){targetEnds++;} },
        Timer:class {
          last=0;delta=0;
          connect(){}dispose(){}
          update(time){this.delta=(time-this.last)/1000;this.last=time;ticks.push(time);}
          getDelta(){return this.delta;}
        },
      }));
      mock.module("./src/world/xr-session.ts",()=>({createXrSessionControl:()=>({unload:async()=>{}})}));
      globalThis.document = {};
      globalThis.ResizeObserver = class {observe(){}disconnect(){}};
      const { createWorld } = await import("./src/world/world-runtime.ts");
      const canvas={getContext:()=>({}),addEventListener(){},width:640,height:360};
      const viewport={clientWidth:640,clientHeight:360};
      const world = createWorld({canvas,viewport});
      const hidden = new THREE.Object3D();hidden.visible=false;world.scene.add(hidden);
      const first = world.prepareRenderer();
      assert.equal(world.prepareRenderer(),first,"concurrent callers share in-flight compilation");
      world.start(delta=>deltas.push(delta));
      loop(10);loop(20);assert.equal(deltas.length,0);assert.equal(renders,0);
      compileRequests[0].resolve();await first;
      assert.equal(renders,1);assert.equal(hidden.visible,false);assert.equal(hidden.frustumCulled,true);
      assert.equal(target,originalTarget);assert.equal(face,2);assert.equal(mip,3);assert.equal(renderer.xr.enabled,true);
      loop(30);assert.deepEqual(deltas,[0.01]);

      viewport.clientWidth=2560;viewport.clientHeight=1440;
      const desktopProjection=world.camera.projectionMatrix.clone();
      renderer.xr.isPresenting=true;xrListeners.get("sessionstart")();
      assert.equal(canvas.width,1280);assert.equal(canvas.height,720);
      assert.ok(world.camera.projectionMatrix.equals(desktopProjection),"mirror resize never replaces headset projection");
      viewport.clientWidth=600;viewport.clientHeight=400;
      renderer.xr.isPresenting=false;xrListeners.get("sessionend")();
      assert.equal(world.camera.aspect,1.5,"desktop projection follows the current viewport on XR exit");

      const second=world.prepareRenderer();assert.notEqual(second,first);
      loop(100);loop(110);assert.equal(deltas.length,1);
      compileRequests[1].reject(new Error("compile failed"));await assert.rejects(second,/compile failed/);
      loop(120);assert.deepEqual(deltas,[0.01,0.01]);
      assert.deepEqual(ticks,[10,20,30,100,110,120],"held frames still sample elapsed time");

      failRender=true;
      const failedWarmup=world.prepareRenderer();compileRequests[2].resolve();
      await assert.rejects(failedWarmup,/warmup failed/);
      assert.equal(target,originalTarget);assert.equal(face,2);assert.equal(mip,3);
      assert.equal(renderer.xr.enabled,true);assert.equal(hidden.visible,false);assert.equal(targetEnds,2);
      const cancelled=world.prepareRenderer();
      const cancellation=assert.rejects(cancelled,error=>error.name==="AbortError");
      let stopped=false;const stopping=world.stop().then(()=>{stopped=true;});
      await Promise.resolve();assert.equal(stopped,false);assert.equal(loop,null);
      compileRequests[3].resolve();await cancellation;await stopping;
      assert.equal(renders,4,"cancellation skips its warmup draw");
      await world.unload();assert.equal(rendererEnds,1);assert.equal(contextEnds,1);
      assert.equal(xrListeners.size,0,"World releases its mirror resize listeners");
      `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await probe.exited;
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(exitCode).toBe(0);
});
