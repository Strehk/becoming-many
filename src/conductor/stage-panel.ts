/**
 * Purpose: Hold the stage view and the controls that face the visitor.
 * Context: The page hosts the world; its session streams to the glasses.
 * Responsibility: Frame the preview, run the stream button, offer the restart.
 * Boundary: Session logic lives in the world's contract; transport stays in
 *   the transport panel. Event-driven — this is not a per-frame panel.
 */

import type { XrSessionControl } from "../world/xr-session";
import { createButton, createConfirmButton } from "./panel-buttons";
import type { ShowActions } from "./show-actions";
import { resolveStreamButton } from "./stream-button";

export interface StagePanelOptions {
  readonly parent: HTMLElement;
  /** The element the level renders into; the world owns its children. */
  readonly stageMount: HTMLElement;
  readonly xr: XrSessionControl;
  readonly actions: ShowActions;
}

export function createStagePanel({
  parent,
  stageMount,
  xr,
  actions,
}: StagePanelOptions): void {
  const root = document.createElement("section");
  root.className = "conductor__stage";
  root.setAttribute("aria-label", "Stage");

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

  const controls = document.createElement("div");
  controls.className = "conductor__stage-controls";

  let isSessionActive = false;
  const streamButton = createButton(controls, "No Stream Available", () => {
    const request = isSessionActive ? xr.stop() : xr.start();
    request.catch((reason) => {
      console.warn("The stream session request failed.", reason);
    });
  });
  streamButton.classList.add("conductor__stream-button");

  const restartButton = createConfirmButton(
    controls,
    "⟲ restart experience",
    () => actions.restartExperience(),
  );
  restartButton.classList.add("conductor__restart-button");

  root.append(view, controls);
  parent.append(root);

  // While a session runs, Three.js renders into the headset and the canvas
  // holds its last frame — said out loud so a frozen preview reads as normal.
  xr.subscribe((state) => {
    isSessionActive = state.isSessionActive;
    overlay.hidden = !state.isSessionActive;

    const buttonView = resolveStreamButton(state);
    streamButton.textContent = buttonView.label;
    streamButton.disabled = !buttonView.isEnabled;
  });
}
