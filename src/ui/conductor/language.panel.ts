import { NARRATION_LANGUAGES } from "../../dramaturgy/narration-catalog";
import type { RunningShow } from "../../levels/show.runtime";
import { requireElement } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface LanguagePanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly show: Pick<RunningShow, "setLanguage">;
}

export function createLanguagePanel({
  parent,
  signal,
  show,
}: LanguagePanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__language", HTMLElement);
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

  return {
    update(state): void {
      const { language } = state;

      languageButtons.forEach((button, index) => {
        button.setAttribute(
          "aria-pressed",
          String(NARRATION_LANGUAGES[index] === language),
        );
      });
    },
  };
}
