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
import type { ShowStatus } from "../station/station-protocol";

export interface ConductorState {
  /** The last status the show sent, or undefined if none has arrived. */
  readonly status: ShowStatus | undefined;

  /** This page's own socket to the broker. */
  readonly isStationConnected: boolean;

  /** The broker's word on whether the show window is there at all. */
  readonly isShowConnected: boolean;

  /**
   * The show is connected and still reporting. A stale status means the show
   * window stopped answering even though the socket is open, and the page must
   * not keep drawing a playhead as though the piece were still running.
   */
  readonly isLive: boolean;

  /** Projected between statuses, or the operator's own position while scrubbing. */
  readonly showTimeSeconds: number;

  /** The language the timeline is measured against. */
  readonly language: NarrationLanguage;

  /** The cue the operator has opened in the inspector. */
  readonly selectedCueId: NarrationCueId | undefined;

  readonly isScrubbing: boolean;
}

/** One panel of the page. Panels never hold state; they only render it. */
export interface ConductorPanel {
  readonly update: (state: ConductorState) => void;
}
