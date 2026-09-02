/**
 * Purpose: Provide the shared button constructors for conductor panels.
 * Context: Transport and stage panels build the same kinds of controls.
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

/**
 * A destructive action asks twice. A blocking `window.confirm` is the wrong
 * tool: it would freeze this page's own clock — and with it the show.
 */
export function createConfirmButton(
  parent: HTMLElement,
  labelText: string,
  onConfirm: () => void,
): HTMLButtonElement {
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;

  function disarm(button: HTMLButtonElement): void {
    clearTimeout(disarmTimer);
    button.dataset.armed = "false";
    button.textContent = labelText;
  }

  const button = createButton(parent, labelText, () => {
    if (button.dataset.armed === "true") {
      disarm(button);
      onConfirm();
      return;
    }

    button.dataset.armed = "true";
    button.textContent = "confirm?";
    disarmTimer = setTimeout(
      () => disarm(button),
      CONDUCTOR_SETTINGS.confirmMilliseconds,
    );
  });

  return button;
}
