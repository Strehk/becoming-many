/**
 * Purpose: Provide the show page's plain VR entry button.
 * Context: The default page renders full-window for rehearsal and development.
 * Responsibility: Mount one fixed button reflecting the session contract.
 * Boundary: Session logic lives in xr-session; the operator page has its own UI.
 */

import type { XrSessionControl } from "../world/xr-session";

export function mountVrEntryButton(
  container: HTMLElement,
  xr: Pick<XrSessionControl, "subscribe" | "start" | "stop">,
): () => void {
  const button = document.createElement("button");
  button.type = "button";

  button.className = "xr-entry-button";

  let isSessionActive = false;

  const unsubscribe = xr.subscribe((state) => {
    isSessionActive = state.isSessionActive;
    if (state.isSessionActive) {
      button.textContent = "Exit VR";
      button.disabled = false;
    } else if (state.availability === "available") {
      button.textContent = "Enter VR";
      button.disabled = false;
    } else {
      button.textContent = "VR not available";
      button.disabled = true;
    }
  });

  button.addEventListener("click", () => {
    const request = isSessionActive ? xr.stop() : xr.start();
    request.catch((reason) => {
      console.warn("The VR session request failed.", reason);
    });
  });

  container.append(button);
  return () => {
    unsubscribe();
    button.remove();
  };
}
