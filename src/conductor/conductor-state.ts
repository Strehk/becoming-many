/**
 * Purpose: Describe what the conductor page knows at the instant it redraws.
 * Context: Several panels render the same instant and must not disagree.
 * Responsibility: Own the view contract the page passes to every panel.
 * Boundary: How the state is gathered belongs to the page composition root.
 */

import type {
  NarrationCueId,
  NarrationLanguage,
} from "../dramaturgy/narration-catalog";
import type { ShowLevelName } from "../dramaturgy/narration-schedule";
import type { M5OperatorStatus } from "../m5/m5-adapter";

/** One reading of the show this page hosts, taken fresh every frame. */
export interface ShowSnapshot {
  readonly showTimeSeconds: number;
  readonly isPlaying: boolean;
  readonly timeScale: number;
  readonly language: NarrationLanguage;
  /** The world state the timeline currently holds, not a startup preset. */
  readonly levelName: ShowLevelName;
  /** Anything but "running" freezes show time while looking like a pause. */
  readonly audioState: AudioContextState;
  /** Undefined until frames have been measured. */
  readonly framesPerSecond?: number;
  readonly p95Milliseconds?: number;
  /** Undefined under a benchmark build; `state: "off"` while no host is set. */
  readonly m5: M5OperatorStatus | undefined;
}

export interface ConductorState {
  readonly snapshot: ShowSnapshot;

  /** The snapshot's clock, or the operator's own position while scrubbing. */
  readonly showTimeSeconds: number;

  /** The cue the operator has opened in the inspector. */
  readonly selectedCueId: NarrationCueId | undefined;

  readonly isScrubbing: boolean;
}

/** One panel of the page. Panels never hold state; they only render it. */
export interface ConductorPanel {
  readonly update: (state: ConductorState) => void;
}
