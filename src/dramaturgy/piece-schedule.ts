/**
 * Purpose: Author when each narration recording starts in the piece.
 * Context: The piece is the main show; a tutorial schedule follows separately.
 * Responsibility: Provide immutable baked schedule data to the Level Runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { NarrationSchedule } from "./narration-schedule";

/**
 * The piece opens on five seconds of silence. The visitor is on the rig and
 * flying before a voice arrives, so the world is established as a place first
 * and narrated second — and staff have a moment after pressing start in which
 * nothing has been missed yet.
 *
 * `narrationCueAt` answers nothing before the first cue, so the lead-in needs
 * no mechanism: it is the gap in front of `prologue`.
 *
 * Placeholder timing otherwise, to be replaced by times authored by ear: the
 * recordings run back to back with a four-second gap and nothing else is
 * dramaturgically motivated yet. Each slot is sized against the longer of the
 * two languages so neither overruns, leaving at least three seconds of
 * headroom.
 *
 * Each cue also carries the world state it speaks over. The senses ladder up
 * with the narration — scent through magnetic one to one, the finale standing
 * in the full Connections synthesis — and the return strips back to White
 * World, so the piece closes where it opened.
 *
 * The result is 8:41 and is reflected in the current experience and direction
 * documentation.
 */
export const PIECE_SCHEDULE: NarrationSchedule = {
  durationSeconds: 521, // Last cue, its longer recording, and slot margin.
  narration: [
    // Five seconds of lead-in before the first word; every later cue carries
    // that offset, so the slots below are unchanged by it.
    { cueId: "prologue", atSeconds: 5, level: "white-world" }, // Slot 77 s, longest recording 72.4.
    { cueId: "scent", atSeconds: 82, level: "scent" }, // Slot 52 s, longest recording 47.0.
    { cueId: "echo", atSeconds: 134, level: "echo" }, // Slot 33 s, longest recording 28.6.
    { cueId: "motion", atSeconds: 167, level: "motion" }, // Slot 63 s, longest recording 58.4.
    { cueId: "thermal", atSeconds: 230, level: "thermal" }, // Slot 49 s, longest recording 44.6.
    { cueId: "magnetic", atSeconds: 279, level: "magnetic" }, // Slot 56 s, longest recording 51.0.
    { cueId: "finale", atSeconds: 335, level: "connections" }, // Slot 111 s, longest recording 106.9.
    { cueId: "return", atSeconds: 446, level: "white-world" }, // Slot 75 s, longest recording 73.8.
  ],
};
