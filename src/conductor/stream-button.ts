/**
 * Purpose: Decide what the headset button says for a given session state.
 * Context: One label answers "can I start the headset picture right now".
 * Responsibility: Map the XR session state to a label and an enabled flag.
 * Boundary: Pure decision logic; the DOM around it lives in the session bar.
 */

import type { XrSessionState } from "../world/xr-session";

export type StreamButtonLabel =
  | "Start headset picture"
  | "Stop headset picture"
  | "No headset connected";

export interface StreamButtonView {
  readonly label: StreamButtonLabel;
  readonly isEnabled: boolean;
}

export function resolveStreamButton(state: XrSessionState): StreamButtonView {
  // An active session always offers its own end, whatever availability says:
  // a runtime that vanishes mid-session must not strand the stop control.
  if (state.isSessionActive) {
    return { label: "Stop headset picture", isEnabled: true };
  }
  if (state.availability === "available") {
    return { label: "Start headset picture", isEnabled: true };
  }

  return { label: "No headset connected", isEnabled: false };
}
