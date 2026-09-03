/**
 * Purpose: Lock the authored piece timing against the recordings it plays.
 * Context: Cue times are shared, but the two languages differ in length.
 * Responsibility: Prove every slot fits its recording in both languages.
 * Boundary: How playback follows the schedule is the player's concern.
 */

import { describe, expect, test } from "bun:test";
import { END_CREDITS_FADE_SECONDS } from "../../src/dramaturgy/end-credits";
import {
  NARRATION_CUES,
  narrationUrl,
} from "../../src/dramaturgy/narration-catalog";
import { narrationCueAt } from "../../src/dramaturgy/narration-schedule";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import { cueSlots } from "../../src/dramaturgy/schedule-layout";
import { SENSE_PREWARM_SECONDS } from "../../src/dramaturgy/show-levels";

// ffprobe and HTMLMediaElement can disagree by about one MP3 frame of encoder
// padding, so a slot must clear its recording by more than a rounding error.
const SLOT_MARGIN_SECONDS = 0.5;

// The silence the piece opens on, before the first word.
const LEAD_IN_SECONDS = 5;

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

  test("opens on a lead-in before the first word", () => {
    expect(CUES[0]?.atSeconds).toBe(LEAD_IN_SECONDS);
  });

  test("stays silent through the lead-in", () => {
    expect(narrationCueAt(PIECE_SCHEDULE, 0)).toBeUndefined();
    expect(
      narrationCueAt(PIECE_SCHEDULE, LEAD_IN_SECONDS - 0.01),
    ).toBeUndefined();
  });

  test("speaks the first word once the lead-in is over", () => {
    expect(narrationCueAt(PIECE_SCHEDULE, LEAD_IN_SECONDS)).toEqual({
      cueId: "prologue",
      offsetSeconds: 0,
    });
  });

  test("orders cues strictly forward in time", () => {
    const times = CUES.map((cue) => cue.atSeconds);

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  test("gives every cue a slot long enough for the longer language", () => {
    // cueSlots() is the one place slot arithmetic lives; deriving it a second
    // time here would let the timeline and this guarantee drift apart.
    for (const language of ["en", "de"] as const) {
      for (const slot of cueSlots(PIECE_SCHEDULE, language)) {
        expect(slot.headroomSeconds).toBeGreaterThanOrEqual(
          SLOT_MARGIN_SECONDS,
        );
      }
    }
  });

  // A sense stands its modules up one prewarm window before the cue that
  // reveals it. A slot shorter than that window would start warming the next
  // layer before its own cue had even spoken.
  test("gives every cue a slot longer than the prewarm window", () => {
    for (const slot of cueSlots(PIECE_SCHEDULE, "en")) {
      expect(slot.slotSeconds).toBeGreaterThan(SENSE_PREWARM_SECONDS);
    }
  });

  test("ends after the last recording has finished", () => {
    const lastCue = CUES[CUES.length - 1];
    if (!lastCue) throw new Error("The piece schedule has no cues");

    const { en, de } = NARRATION_CUES[lastCue.cueId].durationSeconds;

    expect(PIECE_SCHEDULE.durationSeconds).toBeGreaterThanOrEqual(
      lastCue.atSeconds + Math.max(en, de),
    );
  });

  test("brings the credits up once the English return has finished", () => {
    const lastCue = CUES[CUES.length - 1];
    if (!lastCue) throw new Error("The piece schedule has no cues");
    const { creditsAtSeconds } = PIECE_SCHEDULE;
    if (creditsAtSeconds === undefined) {
      throw new Error("The piece schedule authors no credits time");
    }

    expect(creditsAtSeconds).toBeGreaterThanOrEqual(
      lastCue.atSeconds + NARRATION_CUES[lastCue.cueId].durationSeconds.en,
    );
  });

  // The clock clamps at the show length. A fade that is still running there
  // would freeze part way and never reach a readable panel.
  test("leaves the credits room to fade in before the clock clamps", () => {
    const { creditsAtSeconds, durationSeconds } = PIECE_SCHEDULE;
    if (creditsAtSeconds === undefined) {
      throw new Error("The piece schedule authors no credits time");
    }

    expect(creditsAtSeconds + END_CREDITS_FADE_SECONDS).toBeLessThanOrEqual(
      durationSeconds,
    );
  });

  test("resolves its cues to files served from the audio folder", () => {
    expect(narrationUrl("prologue", "en")).toBe("/audio/en/1.mp3");
    expect(narrationUrl("return", "de")).toBe("/audio/de/8.mp3");
  });
});
