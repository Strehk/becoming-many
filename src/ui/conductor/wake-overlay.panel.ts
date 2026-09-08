import { requireElement } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

/** Audio owns wake gestures; this overlay only presents its current state. */
export function createWakeOverlay(parent: HTMLElement, stationName: string | undefined): ConductorPanel {
  const root = requireElement(parent, ".conductor__wake", HTMLElement);
  const station = requireElement(root, ".conductor__wake-station", HTMLElement);
  station.textContent = stationName ?? "";
  station.hidden = !stationName;
  return { update(state): void { root.hidden = state.audioState === "running"; } };
}
