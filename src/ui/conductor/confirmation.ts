import { CONDUCTOR_SETTINGS } from "./operator-settings";

/** Bind a press-twice action; abort clears its timer and restores its label. */
export function bindConfirmation(
  button: HTMLButtonElement,
  armedLabel: string,
  onConfirm: () => void,
  signal: AbortSignal,
): void {
  const label = button.textContent;
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function disarm(): void {
    clearTimeout(timer);
    armed = false;
    button.dataset.armed = "false";
    button.textContent = label;
  }
  signal.addEventListener("abort", disarm, { once: true });
  button.addEventListener("click", () => {
    if (armed) {
      disarm();
      onConfirm();
      return;
    }
    armed = true;
    button.dataset.armed = "true";
    button.textContent = armedLabel;
    timer = setTimeout(disarm, CONDUCTOR_SETTINGS.confirmMilliseconds);
  }, { signal });
}
