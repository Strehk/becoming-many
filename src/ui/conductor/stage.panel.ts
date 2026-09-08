import { requireElement } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface StagePanelOptions {
  readonly parent: HTMLElement;
  /** The HTML-owned viewport containing the renderer's borrowed canvas. */
  readonly stageMount: HTMLElement;
}

/** Bind the static stage overlay without moving or owning the renderer canvas. */
export function createStagePanel({
  parent,
  stageMount,
}: StagePanelOptions): ConductorPanel {
  if (!parent.contains(stageMount))
    throw new Error("Stage viewport must belong to the technician drawer.");
  const overlay = requireElement(
    parent,
    ".conductor__stage-overlay",
    HTMLElement,
  );
  return {
    update(state): void {
      overlay.hidden = !state.xr.isSessionActive;
    },
  };
}
