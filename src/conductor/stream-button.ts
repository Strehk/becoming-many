/**
 * Purpose: Decide what the stream button says for a given session state.
 * Context: One label answers "can I start the headset stream right now".
 * Responsibility: Map the XR session state to a label and an enabled flag.
 * Boundary: Pure decision logic; the DOM around it lives in the stage panel.
 */

import type { XrSessionState } from "../world/xr-session";

export type StreamButtonLabel =
  | "Start Stream"
  | "Stop Stream"
  | "No Stream Available";

export interface StreamButtonView {
  readonly label: StreamButtonLabel;
  readonly isEnabled: boolean;
}

export function resolveStreamButton(state: XrSessionState): StreamButtonView {
  // An active session always offers its own end, whatever availability says:
  // a runtime that vanishes mid-session must not strand the stop control.
  if (state.isSessionActive) {
    return { label: "Stop Stream", isEnabled: true };
  }
  if (state.availability === "available") {
    return { label: "Start Stream", isEnabled: true };
  }

  return { label: "No Stream Available", isEnabled: false };
}
