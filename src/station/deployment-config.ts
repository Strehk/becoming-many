/**
 * Purpose: Carry per-station network facts from the environment into the pages.
 * Context: The station server reads env vars its container is started with;
 *   the pages are a static build and learn them by fetching /config on load.
 * Responsibility: Define the config shape, parse it defensively, and load it
 *   failing soft — no server or no endpoint means an empty config.
 * Boundary: What each fact controls is decided where it is applied; authored
 *   tunables stay in the typed settings files, per the engineering standards.
 */

/**
 * Per-station deployment facts. Every field is optional: an absent field
 * means the UI decides, a present field is deployment authority and the UI
 * shows it read-only. These are network identity, not authored configuration.
 */
export interface DeploymentConfig {
  /** M5 controller address (hostname, host:port, or full origin). */
  readonly m5Host?: string;
  /** DeviceId every M5 payload must carry; a stranger's frames warn, never steer. */
  readonly m5DeviceId?: string;
  /** Label telling a technician which station this is. */
  readonly stationName?: string;
}

/**
 * Accepts only non-empty strings and ignores everything else, so a malformed
 * or foreign payload degrades to "not configured" rather than to bad state.
 * The server funnels its env vars through this too: one rule for both sides.
 */
export function parseDeploymentConfig(value: unknown): DeploymentConfig {
  if (typeof value !== "object" || value === null) return {};

  const record = value as Record<string, unknown>;

  return {
    ...readEntry(record, "m5Host"),
    ...readEntry(record, "m5DeviceId"),
    ...readEntry(record, "stationName"),
  };
}

function readEntry(
  record: Record<string, unknown>,
  key: keyof DeploymentConfig,
): Partial<DeploymentConfig> {
  const value = record[key];
  if (typeof value !== "string") return {};

  const trimmed = value.trim();
  return trimmed.length === 0 ? {} : { [key]: trimmed };
}

/**
 * Fetches the station server's /config. In development Vite proxies the path
 * to the server; with nothing answering, the page runs exactly as before —
 * deployment config is an overlay, never a requirement.
 */
export async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  try {
    const response = await fetch("/config");
    if (!response.ok) return {};

    return parseDeploymentConfig(await response.json());
  } catch {
    return {};
  }
}
