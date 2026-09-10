import type { BenchmarkRun } from "../benchmark/benchmark-run";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type { M5Runtime } from "../m5/m5-contract";
import type { GraphicsInfo, RenderCounters } from "../world/world-contract";
import type { XrSessionControl } from "../world/xr-contract";
import type { LevelPreset } from "./level-preset";
import type { RunningShow, ShowRequest } from "./show-contract";

/** One experience lifetime, with commands and observations for its entry/UI. */
export interface Run {
  readonly renderCounters: RenderCounters;
  /** Diagnostic reads only; never called by the frame loop. */
  readonly readGraphicsInfo: () => GraphicsInfo;
  readonly unload: () => Promise<void>;
  readonly show: RunningShow | undefined;
  readonly training: RunningShow | undefined;

  /**
   * Reset the rig and retained training practice/audio, without rewinding Show.
   * The visitor's local head pose remains owned by pointer look or the headset.
   */
  readonly resetFlight: () => void;
  /** Rewind, reset the flight rig and hold; this does not replace the Run. */
  readonly resetShowAndFlight: () => void;

  /**
   * The M5 tilt controller, idle until a host is set (by the conductor page,
   * a deployment config, or a `?m5=` request). Undefined under a benchmark.
   */
  readonly m5: Pick<M5Runtime, "setHost" | "readObservation"> | undefined;

  /** The renderer's WebXR session, for the page that owns the entry button. */
  readonly xr: Pick<XrSessionControl, "start" | "stop" | "subscribe">;
}

interface CommonLevelRequest {
  readonly signal?: AbortSignal;
  readonly preset: LevelPreset;
  readonly language?: NarrationLanguage;
  /** Entry-owned diagnostic work; absent from normal Experience runs. */
  readonly onFrame?: (deltaSeconds: number) => void;
}

export interface StaticLevelRequest extends CommonLevelRequest {
  readonly kind: "static";
  readonly benchmark?: BenchmarkRun;
}

export interface ShowLevelRequest extends CommonLevelRequest {
  readonly kind: "show";
  readonly show: ShowRequest;
  readonly tutorial?: LevelPreset;
}

/** Both run modes construct one preset; Show adds its timeline and live states. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;
