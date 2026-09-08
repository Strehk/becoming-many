/**
 * Purpose: Turn the suspended audio context into a full-screen "tap to wake".
 * Context: Show time derives from the audio clock, so a context that never
 *   received a gesture freezes the piece while looking exactly like a pause.
 * Responsibility: Cover the page until the audio runs, say which station this
 *   is, and say what one tap does.
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

  // The same order the masthead uses, at the size of a room rather than a
  // desk: the piece names itself quietly and the station loudly, because a
  // person walking up to a dark screen needs to know which station it is.
  const identity = document.createElement("div");
  identity.className = "conductor__wake-identity";

  const piece = document.createElement("span");
  piece.className = "conductor__wake-piece";
  piece.textContent = "Becoming Many";
  identity.append(piece);

  if (stationName) {
    const station = document.createElement("span");
    station.className = "conductor__wake-station";
    station.textContent = stationName;
    identity.append(station);
  }

  // Without a deployed name the piece is the whole identity, and it takes the
  // station's weight rather than leaving the screen top-heavy.
  identity.dataset.named = String(Boolean(stationName));

  const rule = document.createElement("div");
  rule.className = "conductor__wake-rule";

  const headline = document.createElement("span");
  headline.className = "conductor__wake-headline";

  const hint = document.createElement("span");
  hint.className = "conductor__wake-hint";

  const pill = document.createElement("span");
  pill.className = "conductor__wake-pill";

  root.append(identity, rule, headline, hint, pill);
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
