import { requireElement, writeText } from "../shared/dom";
/**
 * Purpose: Keep every control that can break a live show out of casual reach.
 * Context: Rehearsal speeds, resets, the page reload, the M5 host, and the
 *   raw readings are technician tools; front-of-house must not hit them by
 *   accident, so they live behind one deliberate toggle.
 * Responsibility: Own the drawer surface, the rehearsal and reset controls,
 *   and the raw readouts; offer mounts for the stage view and the M5 panel.
 * Boundary: The drawer slides rather than unmounts, so the world's canvas
 *   inside it keeps its layout size while hidden.
 */

import type { Run } from "../../levels/level.runtime";
import type { RunningShow } from "../../levels/show.runtime";
import type { M5OperatorStatus } from "../../m5/m5-adapter";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";
import { bindConfirmation } from "./confirmation";

export interface TechDrawerOptions {
  readonly parent: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly signal: AbortSignal;
  readonly show: Pick<RunningShow, "setTimeScale" | "resetTime">;
  readonly run: Pick<Run, "resetFlight">;
  readonly reloadPage: () => void;
}

export interface TechDrawer {
  readonly toggle: () => void;
  /** Where the stage view panel mounts, above the controls. */
  readonly stageParent: HTMLElement;
  /** Where the M5 host panel mounts, below the resets. */
  readonly m5Parent: HTMLElement;
  readonly panel: ConductorPanel;
}

export function createTechDrawer({
  parent,
  trigger,
  signal,
  show,
  run,
  reloadPage,
}: TechDrawerOptions): TechDrawer {
  const root = requireElement(parent, ".conductor__drawer", HTMLElement);
  const closeButton = requireElement(root, ".conductor__drawer-close", HTMLButtonElement);
  let isOpen = false;
  function setOpen(open: boolean): void {
    isOpen = open;
    root.inert = !open;
    root.dataset.open = String(open);
    trigger.setAttribute("aria-expanded", String(open));
  }
  function toggle(): void {
    setOpen(!isOpen);
    (isOpen ? closeButton : trigger).focus({ preventScroll: true });
  }
  setOpen(false);
  closeButton.addEventListener("click", toggle, { signal });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen) return;
    event.preventDefault();
    toggle();
  }, { signal });
  signal.addEventListener("abort", () => setOpen(false), { once: true });
  const stageParent = requireElement(root, "[data-stage-parent]", HTMLElement);
  const m5Parent = requireElement(root, "[data-m5-parent]", HTMLElement);
  const rateButtons = CONDUCTOR_SETTINGS.timeScales.map((timeScale) => {
    const button = requireElement(root, `[data-time-scale="${timeScale}"]`, HTMLButtonElement);
    button.addEventListener("click", () => show.setTimeScale(timeScale), { signal });
    return button;
  });
  requireElement(root, "[data-reset-show]", HTMLButtonElement).addEventListener("click", show.resetTime, { signal });
  requireElement(root, "[data-reset-flight]", HTMLButtonElement).addEventListener("click", run.resetFlight, { signal });
  bindConfirmation(requireElement(root, ".conductor__reload-button", HTMLButtonElement), "Tap again to reload", reloadPage, signal);
  const frames = bindReadout(root, "frames");
  const m5 = bindReadout(root, "m5");
  const level = bindReadout(root, "level");
  const audio = bindReadout(root, "audio");
  const language = bindReadout(root, "language");

  return {
    toggle,
    stageParent,
    m5Parent,
    panel: {
      update(state): void {
        rateButtons.forEach((button, index) => {
          button.setAttribute(
            "aria-pressed",
            String(CONDUCTOR_SETTINGS.timeScales[index] === state.timeScale),
          );
        });

        frames.write(frameText(state.framesPerSecond, state.p95Milliseconds));
        m5.write(m5Text(state.m5));
        level.write(state.activeLevel);
        audio.write(state.audioState);
        language.write(state.language.toUpperCase());
      },
    },
  };
}

function bindReadout(parent: HTMLElement, name: string): { write: (text: string) => void } {
  const output = requireElement(parent, `[data-reading="${name}"]`, HTMLOutputElement);
  return { write(text): void { writeText(output, text); } };
}

function frameText(
  framesPerSecond: number | undefined,
  p95Milliseconds: number | undefined,
): string {
  if (framesPerSecond === undefined || p95Milliseconds === undefined) {
    return "—";
  }

  return `${Math.round(framesPerSecond)} fps · ${p95Milliseconds.toFixed(1)} ms p95`;
}

/**
 * The Controller tile shows the rejection reason or live sample quality.
 */
function m5Text(status: M5OperatorStatus | undefined): string {
  if (status === undefined || status.state === "off") return "—";

  if (status.state !== "live") return status.state.replaceAll("-", " ");

  return `live · q${status.quality.toFixed(2)}`;
}

