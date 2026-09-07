/**
 * Purpose: Run the permanent minimal world rendering infrastructure.
 * Context: Every level runs through the same permanent Three.js infrastructure.
 * Responsibility: Own rendering resources, shared runtimes, resize, and one loop.
 * Boundary: Level interpretation, controls, and concrete modules stay separate.
 */

import {
  type Group,
  type PerspectiveCamera,
  Scene,
  Timer,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { ModuleRuntime } from "./module-runtime";
import { StreamQueue } from "./stream-queue";
import { createViewerRig, type Viewpoint } from "./viewer-rig";
import { WORLD_RUNTIME_SETTINGS } from "./world-settings";
import { createXrSessionControl, type XrSessionControl } from "./xr-session";

export interface WorldContext {
  readonly scene: Scene;
  /**
   * The rendering camera. Its transform belongs to the head — projection and
   * frustum are the only things outside `viewer-rig.ts` may touch.
   */
  readonly camera: PerspectiveCamera;
  /** The transform locomotion moves. The camera under it belongs to the head. */
  readonly viewerRig: Group;
  /** Where the visitor is, in world space. Modules read this, never the camera. */
  readonly viewpoint: Viewpoint;
  readonly renderer: WebGLRenderer;
  readonly modules: ModuleRuntime;
  readonly streamQueue: StreamQueue;
  readonly xr: XrSessionControl;
}

/** One finished frame, reported after its render call completed. */
export interface WorldFrame {
  readonly frameIndex: number;
  /** Raw animation-loop timestamp; measured frame cost stays outside. */
  readonly timeMilliseconds: number;
  readonly renderer: WebGLRenderer;
  readonly streamQueue: StreamQueue;
}

/**
 * Replaces the wall clock and observes finished frames so a measurement run
 * depends on the frame index alone. Absent during normal interactive use.
 */
interface FrameControl {
  readonly fixedDeltaSeconds: number;

  /**
   * Virtual clock for the stream queue. Its budget is wall-clock based, so a
   * faster machine would otherwise complete more streaming work per frame and
   * produce different resident content — and different counters.
   */
  readonly readStreamTimeMilliseconds?: () => number;

  /** Runs after render; returning false stops the loop. */
  readonly afterFrame: (frame: WorldFrame) => boolean;
}

interface WorldOptions {
  readonly frameControl?: FrameControl;
  readonly viewPitchAssistDegrees?: number;
}

/** Create the stopped world; its caller prepares content before starting frames. */
export function createWorld(
  container: HTMLElement,
  options: WorldOptions = {},
): WorldContext & {
  readonly prepareRenderer: () => Promise<void>;
  readonly start: (updateWorld: (deltaSeconds: number) => void) => void;
  /** Stop execution and finish pending preparation/XR before content is freed. */
  readonly stop: () => Promise<void>;
  /** Release the renderer after Run has ended its content and source assets. */
  readonly unload: () => Promise<void>;
} {
  const { frameControl, viewPitchAssistDegrees = 0 } = options;
  const scene = new Scene();
  const viewer = createViewerRig(viewPitchAssistDegrees);
  // One indivisible act: `WebGLRenderer.render` skips its own camera matrix
  // update once the camera has a parent, so a rig that never reaches the scene
  // graph freezes the view with nothing raised and every test still green.
  scene.add(viewer.group);
  const camera = viewer.camera;
  const lifetime = new AbortController();
  const renderer = createWorldRenderer(lifetime.signal);
  const timer = new Timer();
  const modules = new ModuleRuntime();
  const streamQueue = new StreamQueue(
    WORLD_RUNTIME_SETTINGS.streamQueue,
    frameControl?.readStreamTimeMilliseconds,
  );

  container.replaceChildren(renderer.domElement);
  const xr = createXrSessionControl(renderer);
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
          () => renderer.domElement.remove(),
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
    resizeObserver.observe(container);

    let frameIndex = 0;

    // Three.js owns the single loop for desktop and WebXR.
    renderer.setAnimationLoop((time) => {
      if (lifetime.signal.aborted) return;
      timer.update(time);
      const deltaSeconds = frameControl
        ? frameControl.fixedDeltaSeconds
        : timer.getDelta();

      updateWorld(deltaSeconds);
      if (lifetime.signal.aborted) return;
      // Navigation has moved the rig and nothing refreshes world matrices until
      // the render call. Publishing here, once, is what lets every module in
      // this frame window its content around where the visitor actually is.
      // The eye carries the head pose from the previous frame, because the
      // session writes it inside `render` — centimetres against chunks tens of
      // metres wide, and the price of having exactly one update point.
      viewer.publish();
      modules.update(deltaSeconds);
      streamQueue.update();
      renderer.render(scene, camera);

      if (!frameControl) return;

      const frame: WorldFrame = {
        frameIndex,
        timeMilliseconds: time,
        renderer,
        streamQueue,
      };
      frameIndex += 1;
      if (!frameControl.afterFrame(frame)) renderer.setAnimationLoop(null);
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
      const target = new WebGLRenderTarget(1, 1);
      target.texture.colorSpace = renderer.outputColorSpace;

      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(
          previousTarget,
          previousCubeFace,
          previousMipmapLevel,
        );
        target.dispose();
      }
    })();
    return preparation;
  }

  // The canvas fills its container, so the show page's full-window root and
  // the conductor page's small stage view share one sizing rule. While an XR
  // session presents, Three.js manages the drawing buffer itself.
  function resizeRenderer(): void {
    if (lifetime.signal.aborted || renderer.xr.isPresenting) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

/**
 * One WebGL2 context, XR-compatible from creation so that starting a headset
 * session never has to migrate adapters underneath the running renderer.
 */
function createWorldRenderer(signal: AbortSignal): WebGLRenderer {
  const canvas = document.createElement("canvas");
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
