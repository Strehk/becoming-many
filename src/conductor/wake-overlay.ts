/**
 * Purpose: Turn the suspended audio context into a full-screen "tap to wake".
 * Context: Show time derives from the audio clock, so a context that never
 *   received a gesture freezes the piece while looking exactly like a pause.
 * Responsibility: Cover the page until the audio runs, and say what one tap does.
 * Boundary: The tap itself is handled by the show's own gesture listener; this
 *   overlay only has to not swallow it, so it never stops propagation.
 */

import type { ConductorCopy } from "./conductor-copy";
import type { ConductorPanel } from "./conductor-state";

export function createWakeOverlay(
  parent: HTMLElement,
  stationName: string | undefined,
): ConductorPanel {
  const root = document.createElement("div");
  root.className = "conductor__wake";
  root.hidden = true;

  if (stationName) {
    const station = document.createElement("span");
    station.className = "conductor__wake-station";
    station.textContent = stationName;
    root.append(station);
  }

  const title = document.createElement("span");
  title.className = "conductor__wake-title";
  title.textContent = "Becoming Many";

  const icon = document.createElement("div");
  icon.className = "conductor__wake-icon";
  icon.innerHTML = WAKE_ICON_SVG;

  const headline = document.createElement("span");
  headline.className = "conductor__wake-headline";

  const hint = document.createElement("span");
  hint.className = "conductor__wake-hint";

  const pill = document.createElement("span");
  pill.className = "conductor__wake-pill";

  root.append(title, icon, headline, hint, pill);
  parent.append(root);

  let appliedCopy: ConductorCopy | undefined;

  return {
    update(state): void {
      if (appliedCopy !== state.copy) {
        appliedCopy = state.copy;
        headline.textContent = state.copy.wake.headline;
        hint.textContent = state.copy.wake.hint;
        pill.textContent = state.copy.wake.pill;
      }

      root.hidden = state.snapshot.audioState === "running";
    },
  };
}

// A sleeping bell, drawn inline so it recolors with the page.
const WAKE_ICON_SVG = `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M8 4 a4 4 0 0 1 4 4 v6"></path>
  <path d="M12 14 a4 4 0 1 0 8 0 a4 4 0 0 0 -8 0"></path>
  <path d="M16 12 v2.5 l1.6 1.6"></path>
</svg>`;
