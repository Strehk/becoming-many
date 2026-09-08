import { NARRATION_LANGUAGES } from "../../dramaturgy/narration-catalog";
import type { Run } from "../../levels/level.runtime";
import type { RunningShow } from "../../levels/show.runtime";
import type { XrSessionControl } from "../../world/xr-session";
import { requireElement, writeText } from "../shared/dom";
import { bindConfirmation } from "./confirmation";
import { resolveStreamButton } from "./headset-button-state";
import type { ConductorPanel } from "./view-state";

export interface SessionBarOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly show: Pick<RunningShow, "setLanguage">;
  readonly run: Pick<Run, "resetShowAndFlight">;
  readonly xr: Pick<XrSessionControl, "start" | "stop">;
  readonly onToggleTechDrawer: () => void;
}

export function createSessionBar({
  parent,
  signal,
  show,
  run,
  xr,
  onToggleTechDrawer,
}: SessionBarOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__session-bar", HTMLElement);
  const languageButtons = NARRATION_LANGUAGES.map((language) => {
    const button = requireElement(
      root,
      `[data-language="${language}"]`,
      HTMLButtonElement,
    );
    button.addEventListener("click", () => show.setLanguage(language), {
      signal,
    });
    return button;
  });
  bindConfirmation(
    requireElement(root, ".conductor__restart-button", HTMLButtonElement),
    "Tap again to reset",
    run.resetShowAndFlight,
    signal,
  );
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
  const techButton = requireElement(
    root,
    ".conductor__tech-button",
    HTMLButtonElement,
  );
  techButton.addEventListener("click", onToggleTechDrawer, { signal });

  return {
    update(state): void {
      const { language, xr: xrState } = state;

      languageButtons.forEach((button, index) => {
        button.setAttribute(
          "aria-pressed",
          String(NARRATION_LANGUAGES[index] === language),
        );
      });

      isSessionActive = xrState.isSessionActive;
      const view = resolveStreamButton(xrState);
      writeText(streamLabel, view.label);
      streamButton.disabled = !view.isEnabled;
      streamButton.dataset.streaming = String(xrState.isSessionActive);
    },
  };
}
