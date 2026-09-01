/**
 * Purpose: Define how the conductor page paces and responds under the operator.
 * Context: The page is driven live, mostly by keyboard, during a performance.
 * Responsibility: Keep nudge sizes, rate choices, and timings in one editable place.
 * Boundary: The wire's own timings live in the station settings.
 */

export const CONDUCTOR_SETTINGS = {
  // How far an arrow key moves the show. Small enough to place a word, large
  // enough that holding the key crosses a section.
  nudgeSeconds: 5,

  // The same nudge with Shift held, for moving between sections by hand.
  coarseNudgeSeconds: 30,

  // Offered playback rates. One is the performance rate; the others exist so
  // rehearsal can crawl through a cue or skim to the next one.
  timeScales: [0.25, 0.5, 1, 2] as const,

  // How long a reload button stays armed after the first press. Long enough to
  // confirm deliberately, short enough that a stray click expires on its own.
  reloadConfirmMilliseconds: 3_000,

  // A status older than this means the show window stopped reporting, even if
  // the socket is still open. It has to clear two things that are not faults:
  // a browser throttling timers in an unfocused window down to one per second,
  // and a frame hitch while modules stream. The playhead is projected from the
  // last status in the meantime, so a quiet gap costs no accuracy.
  staleStatusMilliseconds: 2_500,
} as const;
