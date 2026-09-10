import type { M5Runtime } from "../m5-contract";
import { type M5State, parseM5State } from "../protocol";
import { type ControlSource, createControlSource } from "./control-source";
import { M5_SETTINGS } from "./m5-settings";

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
