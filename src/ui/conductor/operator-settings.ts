export const CONDUCTOR_SETTINGS = {
  // Bounded operator observations also run while desktop animation callbacks stall in XR.
  observationIntervalMilliseconds: 100,
  // Retry transient XR failures without flooding the browser or streaming runtime.
  headsetRetryMilliseconds: 2_000,
  // How far an arrow key moves the show. Small enough to place a word, large
  // enough that holding the key crosses a section.
  nudgeSeconds: 5,

  // The same nudge with Shift held, for moving between sections by hand.
  coarseNudgeSeconds: 30,

  // Offered playback rates. One is the performance rate; the others exist so
  // rehearsal can crawl through a cue or skim to the next one.
  timeScales: [0.25, 0.5, 1, 2] as const,

  // How long the reload button stays armed after the
  // first press. Long enough to confirm deliberately, short enough that a
  // stray click expires on its own.
  confirmMilliseconds: 3_000,
} as const;
