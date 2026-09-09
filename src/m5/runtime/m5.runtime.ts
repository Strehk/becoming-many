import type { ControlFrame } from "../control-frame";
import { type M5State, parseM5State } from "../protocol";
import {
  type ControlSource,
  createControlSource,
  type M5ConnectionStatus,
} from "./control-source";
import { M5_SETTINGS } from "./m5-settings";

export type M5DeviceStatus = M5ConnectionStatus | "off";

/**
 * Read-only observation at one timestamp. Sample storage may be shared across
 * observations; never mutate it. Retained observations do not refresh freshness.
 * control contains normalized axes/quality only, never consumable button edges.
 */
export interface M5Observation {
  readonly host: string;
  readonly status: M5DeviceStatus;
  readonly sample: M5State | undefined;
  /** Last parsed reply for diagnostics only, regardless of firmware version. */
  readonly receivedState?: M5State;
  readonly control:
    | Readonly<Pick<ControlFrame, "pitch" | "roll" | "quality">>
    | undefined;
}

export interface M5Runtime {
  /** Replace the complete host lifetime; an empty host stops polling. */
  readonly setHost: (host: string) => void;
  /**
   * Exactly one render-frame reader consumes button edges. Undefined without
   * a host; stale configured input yields neutral steering.
   */
  readonly consumeFrame: () => ControlFrame | undefined;
  readonly readObservation: () => M5Observation;
  /** Abort polling and permanently end this runtime; repeated calls are safe. */
  readonly unload: () => void;
}

/**
 * Run-owned HTTP input. Construction performs no I/O; setHost starts polling.
 * The configured host selects the controller; metadata is diagnostic only.
 * Poll/parse failures age into neutral input rather than rejecting frame reads.
 */
export function createM5Runtime(): M5Runtime {
  let closed = false;
  let source: ControlSource | undefined;
  let currentHost = "";
  let receivedState: M5State | undefined;
  let stopPolling: (() => void) | undefined;

  function setHost(host: string): void {
    if (closed) return;
    stopPolling?.();
    stopPolling = undefined;
    source = undefined;
    receivedState = undefined;
    currentHost = host.trim();
    if (!currentHost) return;

    const currentSource = createControlSource();
    source = currentSource;
    const lifetime = new AbortController();
    const origin = currentHost.includes("://")
      ? currentHost
      : `http://${currentHost}`;
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
        if (state && !signal.aborted) {
          receivedState = state;
          currentSource.pushState(state, Date.now());
        }
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
    consumeFrame: () => source?.consumeFrame(Date.now()),
    readObservation: () => ({
      host: currentHost,
      ...(receivedState ? { receivedState } : {}),
      ...(source?.readObservation(Date.now()) ?? {
        status: "off",
        sample: undefined,
        control: undefined,
      }),
    }),
    unload: () => {
      setHost("");
      closed = true;
    },
  };
}
