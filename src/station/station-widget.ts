/**
 * Purpose: Show the station link state and the way to the conductor page.
 * Context: The default page plays the piece; a broker may or may not run.
 * Responsibility: Own the corner widget's DOM and reflect the socket state.
 * Boundary: The socket lives in station-link; this only displays what it says.
 */

import "./station-widget.css";

export interface StationWidget {
  /** Reflect this window's own socket, as the station link reports it. */
  readonly setConnected: (isConnected: boolean) => void;
}

/**
 * Mount the fixed corner widget. It is an operator surface on the desktop
 * window — DOM never enters the `immersive-vr` view, so the piece itself
 * stays untouched — and the show plays the same whether a broker answers.
 */
export function createStationWidget(container: HTMLElement): StationWidget {
  const root = document.createElement("aside");
  root.className = "station-widget";

  const status = document.createElement("span");
  status.className = "station-widget-status";
  status.textContent = "station offline";

  const conductorLink = document.createElement("a");
  conductorLink.className = "station-widget-link";
  conductorLink.href = "/conductor.html";
  conductorLink.target = "_blank";
  conductorLink.rel = "noopener";
  conductorLink.textContent = "conductor";

  root.append(status, conductorLink);
  container.append(root);

  return {
    setConnected: (isConnected) => {
      status.textContent = isConnected
        ? "station connected"
        : "station offline";
      root.classList.toggle("station-widget-connected", isConnected);
    },
  };
}
