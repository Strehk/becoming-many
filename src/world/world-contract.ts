import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { ModuleRuntime } from "./module-runtime";
import type { StreamQueue } from "./stream-queue";
import type { Viewpoint } from "./viewpoint";
import type { XrSessionControl } from "./xr-contract";

/** On-demand facts from this world's actual rendering context. */
export interface GraphicsInfo {
  readonly renderer: string;
  readonly maxTextureSize: number;
  readonly maxVertexTextures: number;
}

/** Read-only view of the renderer's existing, per-render counters. */
export interface RenderCounters {
  readonly calls: number;
  readonly triangles: number;
}

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

/** DOM placement belongs to the page; World borrows these elements until unload. */
export interface WorldViewport {
  readonly canvas: HTMLCanvasElement;
  readonly viewport: HTMLElement;
}

export interface WorldOptions {
  readonly frameControl?: FrameControl;
  readonly viewPitchAssistDegrees?: number;
}

export type World = WorldContext & {
  readonly renderCounters: RenderCounters;
  readonly readGraphicsInfo: () => GraphicsInfo;
  readonly prepareRenderer: () => Promise<void>;
  readonly start: (updateWorld: (deltaSeconds: number) => void) => void;
  /** Stop execution and finish pending preparation/XR before content is freed. */
  readonly stop: () => Promise<void>;
  /** Release the renderer after Run has ended its content and source assets. */
  readonly unload: () => Promise<void>;
};
