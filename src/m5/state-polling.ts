/**
 * Purpose: Poll one M5 host's /state on an interval and hand over parsed states.
 * Context: The show's adapter owns the one poll of a station's device, which
 *   serves a single client at a time; other views read its samples rather
 *   than opening a poll of their own.
 * Responsibility: Normalize the host into the state URL, guard against
 *   overlapping fetches, and deliver only payloads the parser accepts.
 * Boundary: What a state means — steering, preview, staleness — is the
 *   caller's; an unreachable device simply delivers nothing.
 */

import { type M5State, parseM5State } from "./protocol";

export interface StatePoller {
  /** Poll `host` (hostname, host:port, or full origin); "" stops polling. */
  readonly watch: (host: string) => void;
  readonly stop: () => void;
}

export function createStatePoller(
  intervalMilliseconds: number,
  onState: (state: M5State) => void,
): StatePoller {
  let timer: ReturnType<typeof setInterval> | undefined;
  let isFetchInFlight = false;

  const poll = async (stateUrl: string): Promise<void> => {
    if (isFetchInFlight) return;
    isFetchInFlight = true;
    try {
      const response = await fetch(stateUrl);
      if (!response.ok) return;
      const state = parseM5State(await response.text());
      if (state) onState(state);
    } catch {
      // An unreachable device is a normal state; the caller sees staleness.
    } finally {
      isFetchInFlight = false;
    }
  };

  const stop = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  return {
    watch(host) {
      stop();
      const trimmed = host.trim();
      if (trimmed.length === 0) return;
      const origin = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
      const stateUrl = `${origin.replace(/\/$/, "")}/state`;
      timer = setInterval(() => void poll(stateUrl), intervalMilliseconds);
    },

    stop,
  };
}
