/**
 * Purpose: Hold the between-visitors controls: language, headset, reset.
 * Context: Arming the next session is the one job front-of-house staff do
 *   between visitors, so its controls share one thumb-sized bar.
 * Responsibility: Render the language switch, the headset button, the
 *   "New visitor" reset, and the technician-drawer toggle.
 * Boundary: Session rules live in docs/direction/session-operator.md; the
 *   show is commanded only through the actions contract.
 */

import { NARRATION_LANGUAGES } from "../dramaturgy/narration-catalog";
import type { XrSessionControl } from "../world/xr-session";
import type { ConductorPanel } from "./conductor-state";
import { createButton, createConfirmButton } from "./panel-buttons";
import type { ShowActions } from "./show-actions";
import { resolveStreamButton } from "./stream-button";

export interface SessionBarOptions {
  readonly parent: HTMLElement;
  readonly actions: ShowActions;
  readonly xr: XrSessionControl;
  readonly onToggleTechDrawer: () => void;
}

export function createSessionBar({
  parent,
  actions,
  xr,
  onToggleTechDrawer,
}: SessionBarOptions): ConductorPanel {
  const root = document.createElement("section");
  root.className = "conductor__session-bar";
  root.setAttribute("aria-label", "Session");

  const languageGroup = document.createElement("div");
  languageGroup.className = "conductor__language";
  const languageLabel = document.createElement("span");
  languageLabel.className = "conductor__language-label";
  languageLabel.textContent = "Language";
  languageGroup.append(languageLabel);

  const languageButtons = NARRATION_LANGUAGES.map((language) =>
    createButton(languageGroup, language.toUpperCase(), () => {
      // Language is fixed at arm time; switching mid-piece is a re-arm and
      // holds the show rather than switching under a visitor — see
      // docs/direction/session-operator.md.
      actions.pause();
      actions.setLanguage(language);
    }),
  );

  // The confirm cycle rewrites the button's text, so it stays icon-free.
  const restartButton = createConfirmButton(
    root,
    "New visitor",
    "Tap again to reset",
    () => actions.restartExperience(),
  );
  restartButton.classList.add("conductor__restart-button");

  root.prepend(languageGroup);

  let isSessionActive = false;
  const streamButton = createButton(root, "", () => {
    const request = isSessionActive ? xr.stop() : xr.start();
    request.catch((reason) => {
      console.warn("The headset session request failed.", reason);
    });
  });
  streamButton.classList.add("conductor__stream-button");
  const streamIcon = createIcon(HEADSET_ICON_SVG);
  const streamLabel = document.createElement("span");
  streamButton.append(streamIcon, streamLabel);

  const techButton = createButton(root, "", onToggleTechDrawer);
  techButton.classList.add("conductor__tech-button");
  techButton.setAttribute("aria-label", "Technician tools");
  techButton.append(createIcon(WRENCH_ICON_SVG));

  parent.append(root);

  return {
    update(state): void {
      const { language, xr: xrState } = state.snapshot;

      languageButtons.forEach((button, index) => {
        button.setAttribute(
          "aria-pressed",
          String(NARRATION_LANGUAGES[index] === language),
        );
      });

      isSessionActive = xrState.isSessionActive;
      const view = resolveStreamButton(xrState);
      streamLabel.textContent = view.label;
      streamButton.disabled = !view.isEnabled;
      streamButton.dataset.streaming = String(xrState.isSessionActive);
    },
  };
}

function createIcon(svg: string): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "conductor__button-icon";
  icon.innerHTML = svg;
  return icon;
}

const HEADSET_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14 a8 8 0 0 1 16 0"></path><rect x="2.5" y="13" width="5" height="7" rx="2"></rect><rect x="16.5" y="13" width="5" height="7" rx="2"></rect></svg>`;
const WRENCH_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3 a4.5 4.5 0 0 0 -6 5.6 L3 17.6 V21 h3.4 l5.7 -5.7 a4.5 4.5 0 0 0 5.6 -6 L14.5 12.5 L11.5 9.5 Z"></path></svg>`;
