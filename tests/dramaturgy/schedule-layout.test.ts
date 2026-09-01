/**
 * Purpose: Verify how a schedule lays out in seconds against each language.
 * Context: Slots come from the neighbouring cue, so the last one is a special case.
 * Responsibility: Cover slot derivation, per-language headroom, and the countdown.
 * Boundary: Which recording covers an instant is narration-schedule's concern.
 */

import { describe, expect, test } from "bun:test";
import { NARRATION_CUES } from "../../src/dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../../src/dramaturgy/narration-schedule";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import { cueSlots, nextCueAt } from "../../src/dramaturgy/schedule-layout";

const SCHEDULE: NarrationSchedule = {
  durationSeconds: 200,
  narration: [
    { cueId: "prologue", atSeconds: 0 },
    { cueId: "echo", atSeconds: 100 },
  ],
};

describe("cueSlots", () => {
  test("runs each slot up to the next cue", () => {
    expect(cueSlots(SCHEDULE, "en")[0]?.slotSeconds).toBe(100);
  });

  test("runs the last slot to the end of the show", () => {
    expect(cueSlots(SCHEDULE, "en")[1]?.slotSeconds).toBe(100);
  });

  test("measures the recording in the requested language", () => {
    expect(cueSlots(SCHEDULE, "en")[1]?.recordingSeconds).toBe(
      NARRATION_CUES.echo.durationSeconds.en,
    );
    expect(cueSlots(SCHEDULE, "de")[1]?.recordingSeconds).toBe(
      NARRATION_CUES.echo.durationSeconds.de,
    );
  });

  test("reports headroom as the silence before the next cue", () => {
    const slot = cueSlots(SCHEDULE, "en")[0];

    expect(slot?.headroomSeconds).toBeCloseTo(
      100 - NARRATION_CUES.prologue.durationSeconds.en,
      5,
    );
  });

  test("reports a recording that outlasts its slot as negative headroom", () => {
    const tight: NarrationSchedule = {
      durationSeconds: 40,
      // Prologue runs over a minute, so a twenty-second slot cannot hold it.
      narration: [
        { cueId: "prologue", atSeconds: 0 },
        { cueId: "echo", atSeconds: 20 },
      ],
    };

    expect(cueSlots(tight, "en")[0]?.headroomSeconds).toBeLessThan(0);
  });

  test("keeps a slot for every cue in the piece", () => {
    expect(cueSlots(PIECE_SCHEDULE, "de")).toHaveLength(
      PIECE_SCHEDULE.narration.length,
    );
  });

  test("leaves the shipped piece headroom in both languages", () => {
    for (const language of ["en", "de"] as const) {
      for (const slot of cueSlots(PIECE_SCHEDULE, language)) {
        expect(slot.headroomSeconds).toBeGreaterThan(0);
      }
    }
  });
});

describe("nextCueAt", () => {
  test("names the cue the show is heading for", () => {
    expect(nextCueAt(SCHEDULE, 0)?.cueId).toBe("echo");
    expect(nextCueAt(SCHEDULE, 99.9)?.cueId).toBe("echo");
  });

  test("has nothing left to count down to once the last cue starts", () => {
    expect(nextCueAt(SCHEDULE, 100)).toBeUndefined();
    expect(nextCueAt(SCHEDULE, 150)).toBeUndefined();
  });

  test("counts the first cue before the show begins", () => {
    const late: NarrationSchedule = {
      durationSeconds: 60,
      narration: [{ cueId: "prologue", atSeconds: 10 }],
    };

    expect(nextCueAt(late, 0)?.atSeconds).toBe(10);
  });
});
