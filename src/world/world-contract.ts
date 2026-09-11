import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { ModuleRuntime } from "./module-runtime";
import type { StreamQueue } from "./stream-queue";
import type { Viewpoint } from "./viewpoint";
import type { XrSessionControl } from "./xr-contract";

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

/** DOM placement belongs to the page; World borrows these elements until unload. */
export interface WorldViewport {
  readonly canvas: HTMLCanvasElement;
  readonly viewport: HTMLElement;
}

export interface WorldOptions {
  /** Prone-headset posture assistance; never applied to desktop viewing. */
  readonly xrViewPitchAssistDegrees?: number;
}

export type World = WorldContext & {
  readonly prepareRenderer: () => Promise<void>;
  readonly start: (updateWorld: (deltaSeconds: number) => void) => void;
  /** Stop execution and finish pending preparation/XR before content is freed. */
  readonly stop: () => Promise<void>;
  /** Release the renderer after Run has ended its content and source assets. */
  readonly unload: () => Promise<void>;
};
