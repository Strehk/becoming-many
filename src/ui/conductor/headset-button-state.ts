/** Project actual XR session state into the main operator picture button. */

import type { XrSessionState } from "../../world/xr-contract";

export type StreamButtonLabel =
  | "Picture Off"
  | "Picture On"
  | "Picture unavailable";

export interface StreamButtonView {
  readonly label: StreamButtonLabel;
  readonly isEnabled: boolean;
}

export function resolveStreamButton(state: XrSessionState): StreamButtonView {
  // An active session always offers its own end, whatever availability says:
  // a runtime that vanishes mid-session must not strand the stop control.
  if (state.isSessionActive) {
    return { label: "Picture On", isEnabled: true };
  }
  if (state.availability === "available") {
    return { label: "Picture Off", isEnabled: true };
  }

  return { label: "Picture unavailable", isEnabled: false };
}
