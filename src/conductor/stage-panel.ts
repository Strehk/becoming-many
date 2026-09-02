/**
 * Purpose: Frame the world's stage view for a technician's glance.
 * Context: The page hosts the world; its session streams to the glasses. The
 *   view lives in the technician drawer — front-of-house reads the tiles.
 * Responsibility: Frame the preview and say why it freezes during a session.
 * Boundary: Session controls live in the session bar; the world owns the
 *   mount's children.
 */

import type { ConductorPanel } from "./conductor-state";

export interface StagePanelOptions {
  readonly parent: HTMLElement;
  /** The element the level renders into; the world owns its children. */
  readonly stageMount: HTMLElement;
}

export function createStagePanel({
  parent,
  stageMount,
}: StagePanelOptions): ConductorPanel {
  // The overlay sits beside the mount, never inside it: the world runtime
  // replaces the mount's children with its canvas.
  const view = document.createElement("div");
  view.className = "conductor__stage-view";
  stageMount.className = "conductor__stage-mount";
  const overlay = document.createElement("p");
  overlay.className = "conductor__stage-overlay";
  overlay.textContent = "streaming — paused";
  overlay.hidden = true;
  view.append(stageMount, overlay);
  parent.append(view);

  return {
    // While a session runs, Three.js renders into the headset and the canvas
    // holds its last frame — said out loud so a frozen preview reads as normal.
    update(state): void {
      overlay.hidden = !state.snapshot.xr.isSessionActive;
    },
  };
}
