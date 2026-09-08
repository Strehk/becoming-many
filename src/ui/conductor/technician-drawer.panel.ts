import type { Run } from "../../levels/level.runtime";
import type { RunningShow } from "../../levels/show.runtime";
import type { M5Observation } from "../../m5/runtime/m5.runtime";
import { requireElement, writeText } from "../shared/dom";
import { bindConfirmation } from "./confirmation";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";

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
  const closeButton = requireElement(
    root,
    ".conductor__drawer-close",
    HTMLButtonElement,
  );
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
  root.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || !isOpen) return;
      event.preventDefault();
      toggle();
    },
    { signal },
  );
  signal.addEventListener("abort", () => setOpen(false), { once: true });
  const m5Parent = requireElement(root, "[data-m5-parent]", HTMLElement);
  const rateButtons = CONDUCTOR_SETTINGS.timeScales.map((timeScale) => {
    const button = requireElement(
      root,
      `[data-time-scale="${timeScale}"]`,
      HTMLButtonElement,
    );
    button.addEventListener("click", () => show.setTimeScale(timeScale), {
      signal,
    });
    return button;
  });
  requireElement(root, "[data-reset-show]", HTMLButtonElement).addEventListener(
    "click",
    show.resetTime,
    { signal },
  );
  requireElement(
    root,
    "[data-reset-flight]",
    HTMLButtonElement,
  ).addEventListener("click", run.resetFlight, { signal });
  bindConfirmation(
    requireElement(root, ".conductor__reload-button", HTMLButtonElement),
    "Tap again to reload",
    reloadPage,
    signal,
  );
  const frames = readOutput(root, "frames");
  const m5 = readOutput(root, "m5");
  const level = readOutput(root, "level");
  const audio = readOutput(root, "audio");
  const language = readOutput(root, "language");

  return {
    toggle,
    m5Parent,
    panel: {
      update(state): void {
        rateButtons.forEach((button, index) => {
          button.setAttribute(
            "aria-pressed",
            String(CONDUCTOR_SETTINGS.timeScales[index] === state.timeScale),
          );
        });

        writeText(
          frames,
          frameText(state.framesPerSecond, state.p95Milliseconds),
        );
        writeText(m5, m5Text(state.m5));
        writeText(level, state.activeLevel);
        writeText(audio, state.audioState);
        writeText(language, state.language.toUpperCase());
      },
    },
  };
}

function readOutput(parent: HTMLElement, name: string): HTMLOutputElement {
  return requireElement(parent, `[data-reading="${name}"]`, HTMLOutputElement);
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
function m5Text(status: M5Observation | undefined): string {
  if (status === undefined || status.status === "off") return "—";

  if (status.status !== "live") return status.status.replaceAll("-", " ");

  return `live · input q${(status.control?.quality ?? 0).toFixed(2)}`;
}
