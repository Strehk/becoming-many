/**
 * Purpose: Poll a configured M5 device and hand its frames to the experience.
 * Context: The device is an HTTP server on the station network; the conductor
 *   (or a ?m5 request) names the host, and an empty host means no device.
 * Responsibility: Own the poll lifecycle; everything derived from the
 *   payloads lives in control-source.ts.
 * Boundary: Parsing and steering policy stay in the existing control source.
 */

import type { ControlFrame } from "./control-frame";
import {
  type ControlSource,
  createControlSource,
  type M5DeviceState,
} from "./control-source";
import { M5_SETTINGS } from "./m5-settings";
import { type M5State, parseM5State } from "./protocol";

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
  /**
   * The newest device sample, for views that only glance at it — the
   * conductor's crosshair preview. Reading it consumes nothing, so a second
   * view costs no second poll of the device, which serves one client at a
   * time. Undefined without a host, or while the device is stale or wrong.
   */
  readonly readLatestState: () => M5State | undefined;
  readonly unload: () => void;
}

/** `expectedDeviceId` overrides the authored default when the deployment names one. */
export function createM5Adapter(expectedDeviceId?: string): M5Adapter {
  let source: ControlSource | undefined;
  let stopPolling: (() => void) | undefined;

  function setHost(host: string): void {
    stopPolling?.();
    stopPolling = undefined;
    source = undefined;
    const trimmed = host.trim();
    if (!trimmed) return;

    const currentSource = createControlSource(expectedDeviceId);
    source = currentSource;
    const lifetime = new AbortController();
    const origin = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    const stateUrl = `${origin.replace(/\/$/, "")}/state`;
    let isFetchInFlight = false;

    const poll = async (): Promise<void> => {
      if (isFetchInFlight || lifetime.signal.aborted) return;
      isFetchInFlight = true;
      const signal = AbortSignal.any([
        lifetime.signal,
        AbortSignal.timeout(M5_SETTINGS.staleAfterMilliseconds),
      ]);
      try {
        const response = await fetch(stateUrl, { signal });
        if (!response.ok) return;
        const state = parseM5State(await response.text());
        if (state && !signal.aborted)
          currentSource.pushState(state, Date.now());
      } catch {
        // Failed or timed-out polls become stale at the control source.
      } finally {
        isFetchInFlight = false;
      }
    };

    const timer = setInterval(
      () => void poll(),
      M5_SETTINGS.pollIntervalMilliseconds,
    );
    stopPolling = () => {
      lifetime.abort();
      clearInterval(timer);
    };
    void poll();
  }

  return {
    setHost,
    readFrame: () => source?.readFrame(Date.now()),
    readLatestState: () => source?.readLatestState(Date.now()),
    readOperatorStatus: () =>
      source?.readDeviceReport(Date.now()) ?? { state: "off" },
    unload: () => setHost(""),
  };
}
