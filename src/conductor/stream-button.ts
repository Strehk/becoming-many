/**
 * Purpose: Decide what the one headset button offers right now.
 * Context: The operator needs one answer to "can I start the headset picture".
 * Responsibility: Turn the XR session state into an action and its enabled-ness.
 * Boundary: The word for each action lives in the conductor copy; the DOM
 *   around it lives in the session bar.
 */

import type { XrSessionState } from "../world/xr-session";
import type { StreamAction } from "./conductor-copy";

export interface StreamButtonView {
  readonly action: StreamAction;
  readonly isEnabled: boolean;
}

/**
 * A running session keeps its stop even if availability drops underneath it:
 * the session is the fact, and the operator must still be able to end it.
 */
export function resolveStreamButton(xr: XrSessionState): StreamButtonView {
  if (xr.isSessionActive) return { action: "stop", isEnabled: true };

  if (xr.availability === "available") {
    return { action: "start", isEnabled: true };
  }

  return { action: "unavailable", isEnabled: false };
}
