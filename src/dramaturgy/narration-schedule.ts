/**
 * Purpose: Define the baked narration data and answer what plays when.
 * Context: One schedule authority drives the show; it is authored, not computed.
 * Responsibility: Own the schedule contract and the pure show-time lookup.
 * Boundary: Playback, decoding, and the clock itself live elsewhere.
 */

import type { NarrationCueId } from "./narration-catalog";

/** One narration recording placed on the show timeline. */
export interface NarrationCue {
  /** Names the recording; the narration catalogue resolves it to a file. */
  readonly cueId: NarrationCueId;
  /** Show time this cue starts. Shared by both languages. */
  readonly atSeconds: number;
}

/**
 * The narration facet of the one show schedule. Per-sense intensity envelopes
 * join this contract as a sibling field when they are built.
 */
export interface NarrationSchedule {
  /** Show length; the clock clamps here and rehearsal scrubs within it. */
  readonly durationSeconds: number;

  /**
   * Ordered by `atSeconds`. A cue holds the timeline until the next one starts,
   * which is why no cue carries a duration: the same section runs up to nine
   * seconds longer in German than in English while cue times stay shared.
   * Taking the slot from the neighbours makes that mismatch harmless — the
   * shorter recording finishes early and the player falls silent.
   */
  readonly narration: readonly NarrationCue[];
}

/**
 * Where the show is inside a cue's slot. This is a slot offset, not a file
 * offset: it can exceed the recording's length in the shorter language, and
 * only the player knows that because only the player knows the language.
 */
export interface NarrationCuePosition {
  readonly cueId: NarrationCueId;
  readonly offsetSeconds: number;
}

/** Undefined before the first cue and once the show length is reached. */
export function narrationCueAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): NarrationCuePosition | undefined {
  if (showTimeSeconds >= schedule.durationSeconds) return undefined;

  const nextIndex = schedule.narration.findIndex(
    (cue) => cue.atSeconds > showTimeSeconds,
  );
  const activeIndex =
    (nextIndex === -1 ? schedule.narration.length : nextIndex) - 1;
  const cue = schedule.narration[activeIndex];
  if (!cue) return undefined;

  return { cueId: cue.cueId, offsetSeconds: showTimeSeconds - cue.atSeconds };
}
