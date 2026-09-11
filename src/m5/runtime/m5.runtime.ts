import type { M5Runtime } from "../m5-contract";
import { type M5State, parseM5State } from "../protocol";
import { M5_SETTINGS } from "./m5-settings";

/**
 * Run-owned HTTP flight source. Fresh parsed axes pass through without filtering;
 * firmware owns calibration. Construction performs no I/O until setHost.
 */
export function createM5Runtime(): M5Runtime {
  let closed = false;
  let currentHost = "";
  let receivedState: M5State | undefined;
  let receivedAtMilliseconds = Number.NEGATIVE_INFINITY;
  let stopPolling: (() => void) | undefined;
  const input = { forwardTilt: 0, rightTilt: 0 };

  function readFreshSample(): M5State | undefined {
    return Date.now() - receivedAtMilliseconds <=
      M5_SETTINGS.staleAfterMilliseconds
      ? receivedState
      : undefined;
  }

  function setHost(host: string): void {
    if (closed) return;
    stopPolling?.();
    stopPolling = undefined;
    receivedState = undefined;
    receivedAtMilliseconds = Number.NEGATIVE_INFINITY;
    currentHost = host.trim();
    if (!currentHost) return;

    const origin = currentHost.includes("://")
      ? currentHost
      : `http://${currentHost}`;
    stopPolling = pollState(`${origin.replace(/\/$/, "")}/state`, (state) => {
      receivedState = state;
      receivedAtMilliseconds = Date.now();
    });
  }

  return {
    setHost,
    readInput: () => {
      const sample = readFreshSample();
      input.forwardTilt = sample?.pitch ?? 0;
      // The installation's device roll has the opposite flight-turn polarity.
      input.rightTilt = !sample || sample.roll === 0 ? 0 : -sample.roll;
      return input;
    },
    readObservation: () => {
      const sample = readFreshSample();
      return {
        host: currentHost,
        status: !currentHost ? "off" : sample ? "live" : "connecting",
        sample,
        ...(receivedState ? { receivedState } : {}),
      };
    },
    unload: () => {
      setHost("");
      closed = true;
    },
  };
}

/** One host lifetime owns its interval, pending request and response callback. */
function pollState(
  stateUrl: string,
  accept: (state: M5State) => void,
): () => void {
  const lifetime = new AbortController();
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
      if (state && !signal.aborted) accept(state);
    } catch {
      // Failed or timed-out polls let the latest accepted sample expire.
    } finally {
      isFetchInFlight = false;
    }
  };

  const timer = setInterval(
    () => void poll(),
    M5_SETTINGS.pollIntervalMilliseconds,
  );
  void poll();
  return () => {
    lifetime.abort();
    clearInterval(timer);
  };
}
