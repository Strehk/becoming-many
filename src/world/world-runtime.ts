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
export interface FrameControl {
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

export type WorldUpdate = (deltaSeconds: number) => void;
type SetupWorld = (context: WorldContext) => WorldUpdate | undefined;

/**
 * One WebGL2 context, XR-compatible from creation so that starting a headset
 * session never has to migrate adapters underneath the running renderer.
 */
function createWorldRenderer(): WebGLRenderer {
  const canvas = document.createElement("canvas");
  const attributes: WebGLContextAttributes = WORLD_RUNTIME_SETTINGS.renderer;
  const context = canvas.getContext("webgl2", attributes);
  if (context === null) {
    throw new Error("The browser offered no WebGL2 context to render into.");
  }

  // A lost context takes every buffer, texture, and program with it, and the
  // world quietly rebuilds itself from nothing on the restore — which reads
  // as a page reload rather than as the failure it is. Say it out loud.
  canvas.addEventListener("webglcontextlost", () => {
    console.warn("Renderer: the WebGL context was lost.");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    console.warn("Renderer: the WebGL context was restored.");
  });

  return new WebGLRenderer({
    ...WORLD_RUNTIME_SETTINGS.renderer,
    canvas,
    context,
  });
}

export function startWorld(
  container: HTMLElement,
  setupWorld?: SetupWorld,
  frameControl?: FrameControl,
): void {
  const scene = new Scene();
  const viewer = createViewerRig();
  // One indivisible act: `WebGLRenderer.render` skips its own camera matrix
  // update once the camera has a parent, so a rig that never reaches the scene
  // graph freezes the view with nothing raised and every test still green.
  scene.add(viewer.group);
  const camera = viewer.camera;
  const renderer = createWorldRenderer();
  const timer = new Timer();
  const modules = new ModuleRuntime();
  const streamQueue = new StreamQueue(
    WORLD_RUNTIME_SETTINGS.streamQueue,
    frameControl?.readStreamTimeMilliseconds,
  );

  container.replaceChildren(renderer.domElement);
  const xr = createXrSessionControl(renderer);
  timer.connect(document);

  const updateWorld = setupWorld?.({
    scene,
    camera,
    viewerRig: viewer.group,
    viewpoint: viewer.viewpoint,
    renderer,
    modules,
    streamQueue,
    xr,
  });

  // The canvas fills its container, so the show page's full-window root and
  // the conductor page's small stage view share one sizing rule. While an XR
  // session presents, Three.js manages the drawing buffer itself.
  function resizeRenderer(): void {
    if (renderer.xr.isPresenting) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resizeRenderer();
  new ResizeObserver(resizeRenderer).observe(container);

  let frameIndex = 0;

  // Three.js owns the single loop so it can support WebXR later without replacement.
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const deltaSeconds = frameControl
      ? frameControl.fixedDeltaSeconds
      : timer.getDelta();

    updateWorld?.(deltaSeconds);
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
