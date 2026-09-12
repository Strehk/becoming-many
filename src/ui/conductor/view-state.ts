import type { NarrationLanguage } from "../../dramaturgy/narration-catalog";
import type { ShowLevelName } from "../../dramaturgy/narration-schedule";
import type { RunPlayback } from "../../levels/run-contract";
import type { M5Observation } from "../../m5/m5-contract";
import type { XrSessionState } from "../../world/xr-contract";

/** UI observations; display time follows the pointer during a scrub gesture. */
export interface ConductorViewState {
  readonly showTimeSeconds: number;
  readonly isPlaying: boolean;
  readonly playback: RunPlayback;
  readonly timeScale: number;
  readonly language: NarrationLanguage | undefined;
  readonly activeLevel: ShowLevelName | "tutorial";
  /** Anything but "running" freezes show time while looking like a pause. */
  readonly audioState: AudioContextState;
  /** `status: "off"` while no host is set. */
  readonly m5: M5Observation | undefined;
  /** The headset session, so every panel reads the same instant of it. */
  readonly xr: XrSessionState;
}

/** A UI region with local gesture/display state and no experience policy. */
export interface ConductorPanel {
  readonly update: (state: ConductorViewState) => void;
}
