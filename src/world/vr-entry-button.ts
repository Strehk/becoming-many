/**
 * Purpose: Provide the show page's plain VR entry button.
 * Context: The default page renders full-window for rehearsal and development.
 * Responsibility: Mount one fixed button reflecting the session contract.
 * Boundary: Session logic lives in xr-session; the operator page has its own UI.
 */

import type { XrSessionControl } from "./xr-session";

export function mountVrEntryButton(
  container: HTMLElement,
  xr: XrSessionControl,
): void {
  const button = document.createElement("button");
  button.type = "button";

  // Styled inline because this page has no UI stylesheet of its own; dark
  // controls stay readable on the bright canvas.
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.left = "50%";
  button.style.transform = "translateX(-50%)";
  button.style.padding = "12px 24px";
  button.style.border = "1px solid #111111";
  button.style.borderRadius = "4px";
  button.style.background = "rgba(255, 255, 255, 0.85)";
  button.style.color = "#111111";
  button.style.font = "13px sans-serif";
  button.style.cursor = "pointer";

  let isSessionActive = false;

  xr.subscribe((state) => {
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
}
