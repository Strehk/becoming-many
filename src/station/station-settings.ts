/**
 * Purpose: Define the fixed conditions the station link and broker run under.
 * Context: One localhost broker joins the show window and the conductor page.
 * Responsibility: Keep port, reporting rate, and retry timing in one editable place.
 * Boundary: Message shapes live in the protocol; UI pacing lives in the conductor.
 */

export const STATION_SETTINGS = {
  // Port the broker listens on. Both pages default to it, and `?station=<url>`
  // overrides the whole address when a station runs somewhere else.
  port: 7823,

  // How often the show window reports its state. Ten per second is enough
  // because the conductor advances the playhead locally between reports;
  // raising it costs traffic without making the readout smoother.
  statusHertz: 10,

  // How often a pointer drag on the timeline sends a seek. Every seek re-seeks
  // an audio element, which is audible, so this stays well under frame rate.
  scrubHertz: 20,

  // Wait before a dropped link retries. Short enough that restarting the
  // broker mid-rehearsal reconnects on its own, long enough not to spin.
  reconnectDelayMilliseconds: 1_000,
} as const;

/**
 * Falls back to the station on this machine rather than failing on a missing
 * address. A bare `?station` reads as an empty string, not as absent, so an
 * empty request has to mean the same thing as no request at all.
 */
export function resolveStationUrl(requested: string | null): string {
  return requested || `ws://localhost:${STATION_SETTINGS.port}`;
}
