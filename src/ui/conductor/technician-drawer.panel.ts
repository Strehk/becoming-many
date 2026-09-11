import type { Run } from "../../levels/run-contract";
import type { RunningShow } from "../../levels/show-contract";
import type { M5Observation } from "../../m5/m5-contract";
import { M5_FIRMWARE_VERSION } from "../../m5/protocol";
import type { XrSessionControl } from "../../world/xr-contract";
import { requireElement, writeText } from "../shared/dom";
import { bindConfirmation } from "./confirmation";
import { resolveStreamButton } from "./headset-button-state";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";

export interface TechDrawerOptions {
  readonly parent: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly signal: AbortSignal;
  readonly show: Pick<RunningShow, "setTimeScale" | "resetTime">;
  readonly run: Pick<Run, "resetFlight">;
  readonly reloadPage: () => void;
  readonly xr: Pick<XrSessionControl, "start" | "stop">;
}

export interface TechDrawer {
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
  xr,
}: TechDrawerOptions): TechDrawer {
  const root = requireElement(parent, ".conductor__drawer", HTMLDialogElement);
  const closeButton = requireElement(
    root,
    ".conductor__drawer-close",
    HTMLButtonElement,
  );
  trigger.addEventListener(
    "click",
    () => {
      root.showModal();
      trigger.setAttribute("aria-expanded", "true");
    },
    { signal },
  );
  function close(): void {
    root.close();
    trigger.setAttribute("aria-expanded", "false");
  }
  closeButton.addEventListener("click", close, { signal });
  root.addEventListener(
    "cancel",
    () => {
      trigger.setAttribute("aria-expanded", "false");
    },
    { signal },
  );
  signal.addEventListener("abort", close, { once: true });
  let isSessionActive = false;
  const streamButton = requireElement(
    root,
    ".conductor__stream-button",
    HTMLButtonElement,
  );
  const streamLabel = requireElement(
    streamButton,
    "[data-headset-label]",
    HTMLElement,
  );
  streamButton.addEventListener(
    "click",
    () => {
      const request = isSessionActive ? xr.stop() : xr.start();
      request.catch((reason) =>
        console.warn("The headset session request failed.", reason),
      );
    },
    { signal },
  );
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
  const resetShow = requireElement(
    root,
    "[data-reset-show]",
    HTMLButtonElement,
  );
  resetShow.addEventListener("click", show.resetTime, { signal });
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
  const controllerState = requireElement(
    root,
    "[data-m5-state]",
    HTMLPreElement,
  );
  requireElement(
    root,
    "[data-m5-bundled-firmware]",
    HTMLOutputElement,
  ).textContent = M5_FIRMWARE_VERSION;
  let receivedState: M5Observation["receivedState"];
  const m5 = readOutput(root, "m5");
  const level = readOutput(root, "level");
  const audio = readOutput(root, "audio");
  const language = readOutput(root, "language");

  return {
    m5Parent,
    panel: {
      update(state): void {
        isSessionActive = state.xr.isSessionActive;
        const view = resolveStreamButton(state.xr);
        writeText(streamLabel, view.label);
        streamButton.disabled = !view.isEnabled;
        streamButton.dataset.streaming = String(isSessionActive);

        rateButtons.forEach((button, index) => {
          button.setAttribute(
            "aria-pressed",
            String(CONDUCTOR_SETTINGS.timeScales[index] === state.timeScale),
          );
        });

        writeText(m5, m5Text(state.m5));
        if (receivedState !== state.m5?.receivedState) {
          receivedState = state.m5?.receivedState;
          writeText(
            controllerState,
            receivedState
              ? JSON.stringify(receivedState, null, 2)
              : "No controller response yet.",
          );
        }
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

/**
 * The Controller tile shows connection freshness.
 */
function m5Text(status: M5Observation | undefined): string {
  if (status === undefined || status.status === "off") return "—";

  if (status.status !== "live") return status.status.replaceAll("-", " ");

  return "live";
}
