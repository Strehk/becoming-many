/**
 * Purpose: Poll a configured M5 device and hand its frames to the experience.
 * Context: The device is an HTTP server on the station network; the conductor
 *   (or a ?m5 request) names the host, and an empty host means no device.
 * Responsibility: Own the poll lifecycle; everything derived from the
 *   payloads lives in control-source.ts.
 * Boundary: This is an untested IO shell by repo convention — keep logic out
 *   of it; the shared fetch loop lives in state-polling.ts.
 */

import type { ControlFrame } from "./control-frame";
import { createControlSource, type M5DeviceState } from "./control-source";
import { M5_SETTINGS } from "./m5-settings";
import { createStatePoller } from "./state-polling";

export interface M5OperatorStatus {
  readonly state: M5DeviceState;
  /** Present while polling: the live quality, 0 while connecting. */
  readonly quality?: number;
  readonly hasFirmwareMismatch?: boolean;
}

export interface M5Adapter {
  /** Start polling `host` (hostname, host:port, or full origin); "" stops. */
  readonly setHost: (host: string) => void;
  /**
   * Per render frame; consumes button edges — one reader only. Undefined
   * while no host is configured (desktop steers). With a host set a frame
   * always arrives: a stale or failed poll yields neutral steering, because
   * the glider keeps flying — `quality: 0` means "nothing is steering",
   * never "stop".
   */
  readonly readFrame: () => ControlFrame | undefined;
  readonly readOperatorStatus: () => M5OperatorStatus;
  readonly unload: () => void;
}

export function createM5Adapter(): M5Adapter {
  const source = createControlSource();
  const poller = createStatePoller(
    M5_SETTINGS.pollIntervalMilliseconds,
    (state) => source.pushState(state, Date.now()),
  );
  let hasHost = false;

  return {
    setHost(host) {
      hasHost = host.trim().length > 0;
      poller.watch(host);
    },

    readFrame() {
      if (!hasHost) return undefined;
      return source.readFrame(Date.now());
    },

    readOperatorStatus() {
      if (!hasHost) return { state: "off" };
      const report = source.readDeviceReport(Date.now());
      return {
        state: report.state,
        quality: report.quality,
        hasFirmwareMismatch: report.hasFirmwareMismatch,
      };
    },

    unload: poller.stop,
  };
}
