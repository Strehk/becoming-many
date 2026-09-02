/**
 * Purpose: Name the station server's one shared fact.
 * Context: The Bun server listens on this port; Vite proxies /config to it.
 * Responsibility: Keep the default port where both processes can import it.
 * Boundary: Page pacing lives in the conductor settings; PORT overrides this.
 */

export const STATION_SETTINGS = {
  // The default listen port. Arbitrary, unregistered, above the privileged
  // range; PORT overrides it per deployment.
  port: 7823,
} as const;
