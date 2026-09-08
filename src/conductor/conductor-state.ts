/**
 * Purpose: Describe what the conductor page knows at the instant it redraws.
 * Context: Several panels render the same instant and must not disagree.
 * Responsibility: Own the view contract the page passes to every panel.
 * Boundary: How the state is gathered belongs to the page composition root.
 */

import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type { ShowLevelName } from "../dramaturgy/narration-schedule";
import type { M5OperatorStatus } from "../m5/m5-adapter";
import type { XrSessionState } from "../world/xr-session";
import type { ConductorCopy } from "./conductor-copy";

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
  /** The headset session, so every panel reads the same instant of it. */
  readonly xr: XrSessionState;
}

export interface ConductorState {
  readonly snapshot: ShowSnapshot;

  /**
   * The words the page is currently read in. Panels compare the reference to
   * know a switch happened; the catalogue itself never changes in place.
   */
  readonly copy: ConductorCopy;

  /** The snapshot's clock, or the operator's own position while scrubbing. */
  readonly showTimeSeconds: number;

  readonly isScrubbing: boolean;
}

/**
 * One panel of the page. Panels never hold show state; they only render it —
 * the labels they last wrote are the one thing they may remember, so a
 * language switch costs one comparison a frame instead of a rewrite.
 */
export interface ConductorPanel {
  readonly update: (state: ConductorState) => void;
}
