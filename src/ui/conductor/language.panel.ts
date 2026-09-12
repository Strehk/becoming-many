import { NARRATION_LANGUAGES } from "../../dramaturgy/narration-catalog";
import type { Run } from "../../levels/run-contract";
import { requireElement } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface LanguagePanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly run: Pick<Run, "setLanguage">;
}

export function createLanguagePanel({
  parent,
  signal,
  run,
}: LanguagePanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__language", HTMLElement);
  const languageButtons = NARRATION_LANGUAGES.map((language) => {
    const button = requireElement(
      root,
      `[data-language="${language}"]`,
      HTMLButtonElement,
    );
    button.addEventListener("click", () => run.setLanguage(language), {
      signal,
    });
    return button;
  });

  return {
    update(state): void {
      const { language } = state;
      const available = language !== undefined;

      languageButtons.forEach((button, index) => {
        button.disabled = !available;
        if (!available) {
          button.removeAttribute("aria-pressed");
          return;
        }
        button.setAttribute(
          "aria-pressed",
          String(NARRATION_LANGUAGES[index] === language),
        );
      });
    },
  };
}
