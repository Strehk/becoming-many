import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type { M5Runtime } from "../m5/m5-contract";
import type { XrSessionControl } from "../world/xr-contract";
import type { LevelPreset } from "./level-preset";
import type { RunningShow, ShowRequest } from "./show-contract";

/** A fresh snapshot of earned lessons; tutorial time is deliberately not seekable. */
export interface TutorialObservation {
  readonly completedChunks: number;
  readonly totalChunks: number;
  readonly phase: "active" | "closing" | "transition";
}

/** One experience lifetime, with commands and observations for its entry/UI. */
export interface Run {
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
  /** Rewind, reset the flight rig and hold; this does not replace the Run. */
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
  readonly language?: NarrationLanguage;
}

export interface StaticLevelRequest extends CommonLevelRequest {
  readonly kind: "static";
}

export interface ShowLevelRequest extends CommonLevelRequest {
  readonly kind: "show";
  readonly show: ShowRequest;
  /** Optional guided entry before the prepared main show. */
  readonly tutorial?: LevelPreset;
}

/** Both run modes construct one preset; Show adds its timeline and live states. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;
