/**
 * Purpose: Answer where each cue sits on the timeline and how much room it has.
 * Context: A cue carries no duration; its slot comes from the following cue.
 * Responsibility: Derive slots, recording lengths, and headroom from the schedule.
 * Boundary: Pixels, colours, and playback belong to the caller, not to this file.
 */

import {
  type NarrationCueId,
  type NarrationLanguage,
  narrationDurationSeconds,
} from "./narration-catalog";
import type { NarrationCue, NarrationSchedule } from "./narration-schedule";

/** One cue's place on the timeline, in seconds. */
export interface CueSlot {
  readonly cueId: NarrationCueId;
  readonly atSeconds: number;
  /** Runs to the next cue, or to the end of the show for the last one. */
  readonly slotSeconds: number;
  /** How long the recording actually runs in this language. */
  readonly recordingSeconds: number;
  /**
   * Slot minus recording: the silence before the next cue. Negative means the
   * recording overruns its slot and would be cut off by its successor, which
   * is the invariant `tests/dramaturgy/piece-schedule.test.ts` guards.
   */
  readonly headroomSeconds: number;
}

/**
 * The schedule measured against one language. Cue times are shared between
 * languages and only the recordings differ, so the same schedule lays out
 * differently in German than in English.
 */
export function cueSlots(
  schedule: NarrationSchedule,
  language: NarrationLanguage,
): readonly CueSlot[] {
  return schedule.narration.map((cue, index) => {
    const slotEndSeconds =
      schedule.narration[index + 1]?.atSeconds ?? schedule.durationSeconds;
    const slotSeconds = slotEndSeconds - cue.atSeconds;
    const recordingSeconds = narrationDurationSeconds(cue.cueId, language);

    return {
      cueId: cue.cueId,
      atSeconds: cue.atSeconds,
      slotSeconds,
      recordingSeconds,
      headroomSeconds: slotSeconds - recordingSeconds,
    };
  });
}

/**
 * The cue the show is heading for, which is what a countdown needs. Undefined
 * once the last cue has started: there is nothing further to count down to.
 */
export function nextCueAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): NarrationCue | undefined {
  return schedule.narration.find((cue) => cue.atSeconds > showTimeSeconds);
}
