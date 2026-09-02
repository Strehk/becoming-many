/**
 * Purpose: Define how the conductor page paces and responds under the operator.
 * Context: The page is driven live, mostly by keyboard, during a performance.
 * Responsibility: Keep nudge sizes, rate choices, and timings in one editable place.
 * Boundary: The station server's own facts live in the station settings.
 */

export const CONDUCTOR_SETTINGS = {
  // How far an arrow key moves the show. Small enough to place a word, large
  // enough that holding the key crosses a section.
  nudgeSeconds: 5,

  // The same nudge with Shift held, for moving between sections by hand.
  coarseNudgeSeconds: 30,

  // How far the on-screen buttons move the show. Coarser than the arrow
  // keys: a finger recovering a moment wants one decisive step.
  touchNudgeSeconds: 10,

  // Offered playback rates. One is the performance rate; the others exist so
  // rehearsal can crawl through a cue or skim to the next one.
  timeScales: [0.25, 0.5, 1, 2] as const,

  // How long a destructive button (reload, restart) stays armed after the
  // first press. Long enough to confirm deliberately, short enough that a
  // stray click expires on its own.
  confirmMilliseconds: 3_000,

  // How many seeks per second a timeline drag lands on the show clock. Every
  // seek makes the narration player re-seek its audio element, so scrubbing
  // is paced rather than sent per pointer event.
  scrubHertz: 20,

  // How often the frame metrics are re-read for the status strip. Reading
  // them sorts a ring buffer, which is documented as not-per-frame work.
  metricsIntervalMilliseconds: 500,
} as const;
