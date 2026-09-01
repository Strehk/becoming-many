/**
 * Purpose: Lock the authored piece timing against the recordings it plays.
 * Context: Cue times are shared, but the two languages differ in length.
 * Responsibility: Prove every slot fits its recording in both languages.
 * Boundary: How playback follows the schedule is the player's concern.
 */

import { describe, expect, test } from "bun:test";
import {
  NARRATION_CUES,
  narrationUrl,
} from "../../src/dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";

// ffprobe and HTMLMediaElement can disagree by about one MP3 frame of encoder
// padding, so a slot must clear its recording by more than a rounding error.
const SLOT_MARGIN_SECONDS = 0.5;

const CUES = PIECE_SCHEDULE.narration;

describe("the piece schedule", () => {
  test("plays every recording that exists, exactly once", () => {
    const scheduled = CUES.map((cue) => cue.cueId);

    expect([...scheduled].sort()).toEqual(
      Object.keys(NARRATION_CUES).sort() as typeof scheduled,
    );
  });

  test("starts at or after the beginning of the show", () => {
    expect(CUES[0]?.atSeconds).toBeGreaterThanOrEqual(0);
  });

  test("orders cues strictly forward in time", () => {
    const times = CUES.map((cue) => cue.atSeconds);

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  test("gives every cue a slot long enough for the longer language", () => {
    CUES.forEach((cue, index) => {
      const slotEndSeconds =
        CUES[index + 1]?.atSeconds ?? PIECE_SCHEDULE.durationSeconds;
      const slotSeconds = slotEndSeconds - cue.atSeconds;
      const { en, de } = NARRATION_CUES[cue.cueId].durationSeconds;

      expect(slotSeconds).toBeGreaterThanOrEqual(
        Math.max(en, de) + SLOT_MARGIN_SECONDS,
      );
    });
  });

  test("ends after the last recording has finished", () => {
    const lastCue = CUES[CUES.length - 1];
    if (!lastCue) throw new Error("The piece schedule has no cues");

    const { en, de } = NARRATION_CUES[lastCue.cueId].durationSeconds;

    expect(PIECE_SCHEDULE.durationSeconds).toBeGreaterThanOrEqual(
      lastCue.atSeconds + Math.max(en, de),
    );
  });

  test("resolves its cues to files served from the audio folder", () => {
    expect(narrationUrl("prologue", "en")).toBe("/audio/en/1.mp3");
    expect(narrationUrl("return", "de")).toBe("/audio/de/8.mp3");
  });
});
