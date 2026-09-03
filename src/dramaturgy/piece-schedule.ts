/**
 * Purpose: Author when each narration recording starts in the piece.
 * Context: The piece is the main show; a tutorial schedule follows separately.
 * Responsibility: Provide immutable baked schedule data to the Level Runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { NarrationSchedule } from "./narration-schedule";
import type { PassageSchedule } from "./passage-schedule";

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
  // The return recording ends at 515.6 s in English and 519.9 s in German, so
  // the panel comes up just after the English last word and over the final
  // German lines. Four seconds of fade puts it at full opacity at 520 s, a
  // second before the clock clamps and holds it there.
  creditsAtSeconds: 516,
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

/**
 * How long before its cue boundary an animal enters. The passage runs across
 * the boundary rather than up to it: the animal arrives while the old world
 * still stands, and is gone by the time the new sense has faded in over
 * `SENSE_FADE_SECONDS`. That is the difference between an animal that
 * introduces a sense and one that illustrates it.
 */
const PASSAGE_LEAD_SECONDS = 6;

/**
 * The two animals that cross the piece, each entering before the cue that
 * opens the sense named after it: the bat before Echolocation, the mosquitoes
 * before Motion Perception. Magnetic Field Perception is deliberately left
 * without one — what announced it was a single bird leaving due north, and
 * one animal pointing is a thin way to carry a sense that is about a bearing.
 * The cue opens with nothing crossing ahead of it until something is found
 * that carries the direction.
 *
 * Every duration is the authored route's own length plus its exit, carried
 * unchanged from the routes these passages were tuned against — the bat's
 * 10.4-second track plus a six-second exit, and the mosquito track at the
 * half speed it was played back at. Editing a start time is editing one
 * number here; the durations belong to the routes and should follow them.
 *
 * The mosquitoes keep the same six-second lead as the others even though what
 * they leave behind is motion trails, which is the Motion Perception sense's
 * own material. That is why the swarm carries its own trail ring at full
 * strength instead of the sense's: on the sense's it would be invisible for
 * exactly the seconds in which it is supposed to be announcing it.
 */
export const PIECE_PASSAGES: PassageSchedule = {
  passages: [
    // Enters at 128, gone by 144.4 — the echo cue opens at 134.
    {
      passageId: "bat",
      atSeconds: 134 - PASSAGE_LEAD_SECONDS,
      durationSeconds: 16.416667,
    },
    // Enters at 161, gone by 176 — the motion cue opens at 167.
    {
      passageId: "mosquitoes",
      atSeconds: 167 - PASSAGE_LEAD_SECONDS,
      durationSeconds: 15,
    },
  ],
};
