/**
 * Purpose: Run the permanent minimal world rendering infrastructure.
 * Context: Every level runs through the same permanent Three.js infrastructure.
 * Responsibility: Own rendering resources, shared runtimes, resize, and one loop.
 * Boundary: Level interpretation, controls, and concrete modules stay separate.
 */

import { PerspectiveCamera, Scene, Timer, WebGLRenderer } from "three";
import { ModuleRuntime } from "./module-runtime";
import { StreamQueue } from "./stream-queue";
import { enableWebXR } from "./webxr-entry";
import { WORLD_RUNTIME_SETTINGS } from "./world-settings";

export interface WorldContext {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly modules: ModuleRuntime;
  readonly streamQueue: StreamQueue;
}

export type WorldUpdate = (deltaSeconds: number) => void;
type SetupWorld = (context: WorldContext) => WorldUpdate | undefined;

export function startWorld(
  container: HTMLElement,
  setupWorld?: SetupWorld,
): void {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const renderer = new WebGLRenderer(WORLD_RUNTIME_SETTINGS.renderer);
  const timer = new Timer();
  const modules = new ModuleRuntime();
  const streamQueue = new StreamQueue(WORLD_RUNTIME_SETTINGS.streamQueue);

  container.replaceChildren(renderer.domElement);
  enableWebXR(renderer);
  timer.connect(document);

  const updateWorld = setupWorld?.({
    scene,
    camera,
    renderer,
    modules,
    streamQueue,
  });

  function resizeRenderer(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resizeRenderer();
  window.addEventListener("resize", resizeRenderer);

  // Three.js owns the single loop so it can support WebXR later without replacement.
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const deltaSeconds = timer.getDelta();

    updateWorld?.(deltaSeconds);
    modules.update(deltaSeconds);
    streamQueue.update();
    renderer.render(scene, camera);
  });
}
