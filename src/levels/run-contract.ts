import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { FlightInputSource } from "../control/control-contract";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type { M5Runtime } from "../m5/m5-contract";
import type { XrSessionControl } from "../world/xr-contract";
import type { LevelPreset } from "./level-preset";
import type { RunningShow, ShowRequest } from "./show-contract";

/** Run transport spans tutorial and main Show; loading and failures are never playback. */
export type RunPlayback =
  | "playing"
  | "paused"
  | "loading"
  | "buffering"
  | "blocked"
  | "error"
  | "ended";

/** A fresh snapshot of earned lessons; tutorial time is deliberately not seekable. */
export interface TutorialObservation {
  readonly completedChunks: number;
  readonly totalChunks: number;
  readonly phase: "loading" | "active" | "closing" | "transition" | "error";
  readonly playback: RunPlayback;
}

/**
 * Visitor preferences a page may apply to a running experience. Values outside
 * their range are clamped; invalid numbers fall back to the defaults.
 */
export interface RunPreferences {
  /** Overall loudness of organ and narration, 0 (silent) to 1 (authored). */
  readonly volume: number;
  /** Renderer pixel ratio for the desktop view; XR keeps its own resolution. */
  readonly renderScale: number;
  /** Swap forward and backward tilt for keyboard and controller input. */
  readonly invertPitch: boolean;
  /** Round air particles instead of the authored squares (a quality choice). */
  readonly roundParticles?: boolean;
  /**
   * The page draws the end credits over the screen itself; the world's
   * credits panel then stays hidden, except in an immersive session.
   */
  readonly screenCredits?: boolean;
}

/**
 * The running world as a page may borrow it for an overlay drawn in the same
 * renderer (the web start menu). Scene, camera and renderer are read only;
 * the page adds its own objects to `overlay` and disposes them itself.
 */
export interface RunStage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  /** Rendered with the world; removed from the scene when the Run unloads. */
  readonly overlay: Group;
  /** Height of the ground at a world position (the page's autopilot). */
  readonly groundYAt: (worldX: number, worldZ: number) => number;
  /** Every frame after flight and before rendering; returns its removal. */
  readonly onFrame: (hook: (deltaSeconds: number) => void) => () => void;
}

/** One experience lifetime, with commands and observations for its entry/UI. */
export interface Run {
  readonly stage: RunStage;
  /**
   * During a prelude, the glide speed while the Show still holds at its
   * start. Ignored once the Show has played or without a prelude.
   */
  readonly setPreludeGlide: (metersPerSecond: number) => void;
  /**
   * Back to the prelude, for a page that returns to its menu without
   * reloading: the Show resets to its start and holds, the drawn ground
   * steps back, and the glide continues at the given speed. Ignored
   * without a prelude.
   */
  readonly returnToPrelude: (glideMetersPerSecond: number) => void;
  readonly readPlayback: () => RunPlayback;
  readonly togglePlayback: () => void;
  /** Current session language, available during tutorial and absent after unload. */
  readonly readLanguage: () => NarrationLanguage | undefined;
  /** Replace speech in place; preserve playback, progress and flight. Static runs ignore it. */
  readonly setLanguage: (language: NarrationLanguage) => void;
  /** Apply visitor preferences now and to parts the Run creates later. */
  readonly setPreferences: (preferences: RunPreferences) => void;
  readonly unload: () => Promise<void>;
  readonly show: RunningShow | undefined;
  /** Current audio owner state; closed after unload starts. */
  readonly readAudioState: () => AudioContextState;
  readonly readTutorial: () => TutorialObservation | undefined;
  /** Fade the tutorial, then seek main Show in seconds (clamped) and play by default.
   * Non-finite targets, static runs and ended lifetimes are ignored. Latest request wins.
   */
  readonly skipTutorial: (timeSeconds: number, playing?: boolean) => void;
  /** Observe availability; the main transport is unavailable during the tutorial. */
  readonly subscribeShow: (
    listener: (show: RunningShow | undefined) => void,
  ) => () => void;

  /**
   * Reset the flight rig without rewinding Show.
   * The visitor's local head pose remains owned by pointer look or the headset.
   */
  readonly resetFlight: () => void;
  /** Reset to the tutorial and hold until Play; otherwise rewind Show and hold.
   * Resets flight without replacing renderer/XR/audio. Repeated calls while loading
   * coalesce; ended runs ignore the command. Restart failure remains retryable.
   */
  readonly resetShowAndFlight: () => void;

  /**
   * The M5 tilt controller, idle until a host is set (by the conductor page,
   * a deployment config, or a `?m5=` request).
   */
  readonly m5: Pick<M5Runtime, "setHost" | "readObservation"> | undefined;

  /** The renderer's WebXR session, for the page that owns the entry button. */
  readonly xr: Pick<XrSessionControl, "start" | "stop" | "subscribe">;
}

/**
 * Multipliers on the authored particle look, for a presentation that wants
 * more or larger particles than the installation (the web desktop view).
 */
export interface ParticlePresentation {
  readonly airDensity: number;
  readonly airSize: number;
  readonly scentDensity: number;
  readonly scentSize: number;
}

interface CommonLevelRequest {
  readonly signal?: AbortSignal;
  readonly preset: LevelPreset;
  /** Absent: every particle field keeps its authored density and size. */
  readonly particles?: ParticlePresentation;
}

export interface StaticLevelRequest extends CommonLevelRequest {
  readonly kind: "static";
  readonly language?: NarrationLanguage;
}

export interface ShowLevelRequest extends CommonLevelRequest {
  /** Operator entry waits for Play; audience entry starts playing on its own. */
  readonly initiallyPaused?: boolean;
  readonly kind: "show";
  readonly show: ShowRequest;
  /** Optional guided entry before the prepared main show. */
  readonly tutorial?: LevelPreset;
  /**
   * A page in front of the Show (the web start menu): the Show holds at its
   * start without the white veil, the visitor already glides at the given
   * speed, steered by the page's input, until the first Play.
   */
  readonly prelude?: {
    readonly glideMetersPerSecond: number;
    readonly input?: FlightInputSource;
  };
}

/** Both run modes construct one preset; Show adds its timeline and live states. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;
