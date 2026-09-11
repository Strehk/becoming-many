/**
 * Purpose: Run the permanent minimal world rendering infrastructure.
 * Context: Every level runs through the same permanent Three.js infrastructure.
 * Responsibility: Own rendering resources, shared runtimes, resize, and one loop.
 * Boundary: Level interpretation, controls, and concrete modules stay separate.
 */

import {
  type Object3D,
  Scene,
  Timer,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { ModuleRuntime } from "./module-runtime";
import { StreamQueue } from "./stream-queue";
import { createViewerRig } from "./viewer-rig";
import type { World, WorldOptions, WorldViewport } from "./world-contract";
import { WORLD_RUNTIME_SETTINGS } from "./world-settings";
import { mirrorXrFrame } from "./xr-mirror";
import { createXrSessionControl } from "./xr-session";

/** Create the stopped world; its caller prepares content before starting frames. */
export function createWorld(
  { canvas, viewport }: WorldViewport,
  options: WorldOptions = {},
): World {
  const { xrViewPitchAssistDegrees = 0 } = options;
  const scene = new Scene();
  const viewer = createViewerRig(xrViewPitchAssistDegrees);
  // One indivisible act: `WebGLRenderer.render` skips its own camera matrix
  // update once the camera has a parent, so a rig that never reaches the scene
  // graph freezes the view with nothing raised and every test still green.
  scene.add(viewer.group);
  const camera = viewer.camera;
  const lifetime = new AbortController();
  const renderer = createWorldRenderer(canvas, lifetime.signal);
  const timer = new Timer();
  const modules = new ModuleRuntime();
  const streamQueue = new StreamQueue(WORLD_RUNTIME_SETTINGS.streamQueue);

  const xr = createXrSessionControl(renderer);
  renderer.xr.addEventListener("sessionstart", enterXr);
  renderer.xr.addEventListener("sessionend", leaveXr);
  let resizeObserver: ResizeObserver | undefined;
  let preparation: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let unloading: Promise<void> | undefined;
  timer.connect(document);

  return {
    scene,
    camera,
    viewerRig: viewer.group,
    viewpoint: viewer.viewpoint,
    renderer,
    modules,
    streamQueue,
    xr,
    prepareRenderer,
    start,
    stop,
    unload: (): Promise<void> => {
      unloading ??= (async () => {
        const errors: unknown[] = [];
        try {
          await stop();
        } catch (error) {
          errors.push(error);
        }
        for (const release of [
          () => renderer.dispose(),
          () => renderer.forceContextLoss(),
          () => scene.clear(),
        ]) {
          try {
            release();
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length)
          throw new AggregateError(errors, "World cleanup failed");
      })();
      return unloading;
    },
  };

  function stop(): Promise<void> {
    stopping ??= (async () => {
      lifetime.abort();
      const errors: unknown[] = [];
      for (const release of [
        () => renderer.setAnimationLoop(null),
        () => resizeObserver?.disconnect(),
        () => renderer.xr.removeEventListener("sessionstart", enterXr),
        () => renderer.xr.removeEventListener("sessionend", leaveXr),
        () => timer.dispose(),
      ]) {
        try {
          release();
        } catch (error) {
          errors.push(error);
        }
      }
      // Invalidate XR immediately, then wait before releasing its borrowers.
      const stopped = await Promise.allSettled([xr.unload(), preparation]);
      for (const result of stopped) {
        if (
          result.status === "rejected" &&
          result.reason !== lifetime.signal.reason
        )
          errors.push(result.reason);
      }
      if (errors.length) throw new AggregateError(errors, "World stop failed");
    })();
    return stopping;
  }

  // Keep resizing and the visible loop after successful level preparation.
  function start(updateWorld: (deltaSeconds: number) => void): void {
    lifetime.signal.throwIfAborted();
    resizeRenderer();
    resizeObserver ??= new ResizeObserver(resizeRenderer);
    resizeObserver.observe(viewport);

    // Three.js owns the single loop for desktop and WebXR.
    renderer.setAnimationLoop((time) => {
      if (lifetime.signal.aborted) return;
      timer.update(time);
      // Recreated content must finish first-use work before the visible frame.
      // Keep sampling the timer so preparation time never becomes a flight step.
      if (preparation) return;
      const deltaSeconds = timer.getDelta();

      viewer.beginFrame();
      updateWorld(deltaSeconds);
      if (lifetime.signal.aborted) return;
      // Navigation has moved the rig and nothing refreshes world matrices until
      // the render call. Publishing here, once, is what lets every module in
      // this frame window its content around where the visitor actually is.
      // The eye carries the head pose from the previous frame, because the
      // session writes it inside `render` — centimetres against chunks tens of
      // metres wide, and the price of having exactly one update point.
      viewer.publish(renderer.xr.isPresenting);
      modules.update(deltaSeconds);
      streamQueue.update();
      renderer.render(scene, camera);
      mirrorXrFrame(renderer);
    });
  }

  /** Finish shader compilation and first-use uploads without advancing the run. */
  function prepareRenderer(): Promise<void> {
    lifetime.signal.throwIfAborted();
    preparation ??= (async () => {
      await renderer.compileAsync(scene, camera);
      lifetime.signal.throwIfAborted();
      const previousTarget = renderer.getRenderTarget();
      const previousCubeFace = renderer.getActiveCubeFace();
      const previousMipmapLevel = renderer.getActiveMipmapLevel();
      const previousXrEnabled = renderer.xr.enabled;
      const target = new WebGLRenderTarget(1, 1);
      target.texture.colorSpace = renderer.outputColorSpace;
      const visibility: [Object3D, boolean, boolean][] = [];

      try {
        // Upload resident content even when its first cue or viewing angle is later.
        scene.traverse((object) => {
          visibility.push([object, object.visible, object.frustumCulled]);
          object.visible = true;
          object.frustumCulled = false;
        });
        renderer.xr.enabled = false;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        for (const [object, visible, frustumCulled] of visibility) {
          object.visible = visible;
          object.frustumCulled = frustumCulled;
        }
        renderer.setRenderTarget(
          previousTarget,
          previousCubeFace,
          previousMipmapLevel,
        );
        renderer.xr.enabled = previousXrEnabled;
        target.dispose();
      }
    })().finally(() => {
      preparation = undefined;
    });
    return preparation;
  }

  function enterXr(): void {
    viewer.enterXr();
    resizeRenderer();
  }

  function leaveXr(): void {
    viewer.leaveXr();
    resizeRenderer();
  }

  // The canvas fills its container, so the show page's full-window root and
  // the conductor page's small stage view share one sizing rule. During XR only
  // the canvas buffer changes; headset targets and camera projection stay owned
  // by Three.js. No second render or full headset-sized desktop copy is needed.
  function resizeRenderer(): void {
    if (lifetime.signal.aborted) return;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width === 0 || height === 0) return;

    if (renderer.xr.isPresenting) {
      const mirror = WORLD_RUNTIME_SETTINGS.xrMirror;
      const scale = Math.min(
        1,
        mirror.maximumWidth / width,
        mirror.maximumHeight / height,
      );
      const mirrorWidth = Math.max(1, Math.round(width * scale));
      const mirrorHeight = Math.max(1, Math.round(height * scale));
      if (canvas.width !== mirrorWidth) canvas.width = mirrorWidth;
      if (canvas.height !== mirrorHeight) canvas.height = mirrorHeight;
      return;
    }

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

/**
 * One WebGL2 context, XR-compatible from creation so that starting a headset
 * session never has to migrate adapters underneath the running renderer.
 */
function createWorldRenderer(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): WebGLRenderer {
  const attributes: WebGLContextAttributes = WORLD_RUNTIME_SETTINGS.renderer;
  const context = canvas.getContext("webgl2", attributes);
  if (context === null) {
    throw new Error("The browser offered no WebGL2 context to render into.");
  }

  // A lost context takes every buffer, texture, and program with it, and the
  // world quietly rebuilds itself from nothing on the restore — which reads
  // as a page reload rather than as the failure it is. Say it out loud.
  canvas.addEventListener(
    "webglcontextlost",
    () => {
      console.warn("Renderer: the WebGL context was lost.");
    },
    { signal },
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      console.warn("Renderer: the WebGL context was restored.");
    },
    { signal },
  );

  return new WebGLRenderer({
    ...WORLD_RUNTIME_SETTINGS.renderer,
    canvas,
    context,
  });
}
