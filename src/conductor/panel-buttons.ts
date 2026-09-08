/**
 * Purpose: Provide the shared button constructors for conductor panels.
 * Context: Session bar and drawer panels build the same kinds of controls.
 * Responsibility: Create plain and press-twice-to-confirm buttons.
 * Boundary: What a button does belongs to the panel that creates it.
 */

import { CONDUCTOR_SETTINGS } from "./conductor-settings";

export function createButton(
  parent: HTMLElement,
  labelText: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = labelText;
  button.addEventListener("click", onClick);
  parent.append(button);

  return button;
}

/** A confirm button, with the two labels it says kept re-settable. */
export interface ConfirmButton {
  readonly element: HTMLButtonElement;
  /** Say the same question in another language, armed or not. */
  readonly setLabels: (labelText: string, armedLabelText: string) => void;
}

/**
 * A destructive action asks twice, in words that say what the second tap
 * does. A blocking `window.confirm` is the wrong tool: it would freeze this
 * page's own clock — and with it the show.
 */
export function createConfirmButton(
  parent: HTMLElement,
  onConfirm: () => void,
): ConfirmButton {
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;
  let labelText = "";
  let armedLabelText = "";

  function write(): void {
    button.textContent =
      button.dataset.armed === "true" ? armedLabelText : labelText;
  }

  function disarm(): void {
    clearTimeout(disarmTimer);
    button.dataset.armed = "false";
    write();
  }

  const button = createButton(parent, "", () => {
    if (button.dataset.armed === "true") {
      disarm();
      onConfirm();
      return;
    }

    button.dataset.armed = "true";
    write();
    disarmTimer = setTimeout(disarm, CONDUCTOR_SETTINGS.confirmMilliseconds);
  });
  button.dataset.armed = "false";

  return {
    element: button,
    setLabels(nextLabelText, nextArmedLabelText): void {
      labelText = nextLabelText;
      armedLabelText = nextArmedLabelText;
      write();
    },
  };
}
