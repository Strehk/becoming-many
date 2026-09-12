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

/** One experience lifetime, with commands and observations for its entry/UI. */
export interface Run {
  readonly readPlayback: () => RunPlayback;
  readonly togglePlayback: () => void;
  /** Current session language, available during tutorial and absent after unload. */
  readonly readLanguage: () => NarrationLanguage | undefined;
  /** Replace speech in place; preserve playback, progress and flight. Static runs ignore it. */
  readonly setLanguage: (language: NarrationLanguage) => void;
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

interface CommonLevelRequest {
  readonly signal?: AbortSignal;
  readonly preset: LevelPreset;
}

export interface StaticLevelRequest extends CommonLevelRequest {
  readonly kind: "static";
  readonly language?: NarrationLanguage;
}

export interface ShowLevelRequest extends CommonLevelRequest {
  /** Operator entry waits for Play; audience entry retains automatic tutorial playback. */
  readonly initiallyPaused?: boolean;
  readonly kind: "show";
  readonly show: ShowRequest;
  /** Optional guided entry before the prepared main show. */
  readonly tutorial?: LevelPreset;
}

/** Both run modes construct one preset; Show adds its timeline and live states. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;
