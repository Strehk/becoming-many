/** Transport limits for the single-client device HTTP server. */
export const M5_SETTINGS = {
  // Under six requests per second; firmware samples every 50 milliseconds.
  pollIntervalMilliseconds: 167,
  // Expire steering and abort a stalled request after one second.
  staleAfterMilliseconds: 1_000,
} as const;
