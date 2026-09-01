/**
 * Purpose: Author when each narration recording starts in the piece.
 * Context: The piece is the main show; a tutorial schedule follows separately.
 * Responsibility: Provide immutable baked schedule data to the Level Runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { NarrationSchedule } from "./narration-schedule";

/**
 * Placeholder timing, to be replaced by times authored by ear: the recordings
 * run back to back with a four-second gap and nothing else is dramaturgically
 * motivated yet. Each slot is sized against the longer of the two languages so
 * neither overruns, leaving at least three seconds of headroom.
 *
 * The result is 8:36. `docs/direction/dramaturgy-audio.md` still calls the
 * piece "roughly five minutes", which the 7:41 of English narration alone
 * cannot fit; that conflict is open and is not resolved here.
 */
export const PIECE_SCHEDULE: NarrationSchedule = {
  durationSeconds: 516, // Last cue, its longer recording, and slot margin.
  narration: [
    { cueId: "prologue", atSeconds: 0 }, // Slot 77 s, longest recording 72.4.
    { cueId: "scent", atSeconds: 77 }, // Slot 52 s, longest recording 47.0.
    { cueId: "echo", atSeconds: 129 }, // Slot 33 s, longest recording 28.6.
    { cueId: "motion", atSeconds: 162 }, // Slot 63 s, longest recording 58.4.
    { cueId: "thermal", atSeconds: 225 }, // Slot 49 s, longest recording 44.6.
    { cueId: "magnetic", atSeconds: 274 }, // Slot 56 s, longest recording 51.0.
    { cueId: "finale", atSeconds: 330 }, // Slot 111 s, longest recording 106.9.
    { cueId: "return", atSeconds: 441 }, // Slot 75 s, longest recording 73.8.
  ],
};
