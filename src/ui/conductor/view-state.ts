import type { NarrationLanguage } from "../../dramaturgy/narration-catalog";
import type { ShowLevelName } from "../../dramaturgy/narration-schedule";
import type { M5Observation } from "../../m5/m5-contract";
import type { XrSessionState } from "../../world/xr-contract";

/** UI observations; display time follows the pointer during a scrub gesture. */
export interface ConductorViewState {
  readonly showTimeSeconds: number;
  readonly isPlaying: boolean;
  readonly timeScale: number;
  readonly language: NarrationLanguage;
  readonly activeLevel: ShowLevelName;
  /** Anything but "running" freezes show time while looking like a pause. */
  readonly audioState: AudioContextState;
  /** Undefined until frames have been measured. */
  readonly framesPerSecond?: number;
  readonly p95Milliseconds?: number;
  /** Undefined under a benchmark build; `status: "off"` while no host is set. */
  readonly m5: M5Observation | undefined;
  /** The headset session, so every panel reads the same instant of it. */
  readonly xr: XrSessionState;
}

/** A UI region with local gesture/display state and no experience policy. */
export interface ConductorPanel {
  readonly update: (state: ConductorViewState) => void;
}
