import { NARRATION_LANGUAGES } from "../../dramaturgy/narration-catalog";
import type { RunningShow } from "../../levels/show-contract";
import { requireElement } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface LanguagePanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly show?: Pick<RunningShow, "setLanguage">;
  readonly readShow?: () => Pick<RunningShow, "setLanguage"> | undefined;
}

export function createLanguagePanel({
  parent,
  signal,
  show,
  readShow = () => show,
}: LanguagePanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__language", HTMLElement);
  const languageButtons = NARRATION_LANGUAGES.map((language) => {
    const button = requireElement(
      root,
      `[data-language="${language}"]`,
      HTMLButtonElement,
    );
    button.addEventListener("click", () => readShow()?.setLanguage(language), {
      signal,
    });
    return button;
  });

  return {
    update(state): void {
      const available = !!readShow();
      const { language } = state;

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
