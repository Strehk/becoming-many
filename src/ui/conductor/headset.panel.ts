/**
 * Bind the main picture control and retain the operator's default-on intent.
 * Retry ended sessions through the existing XR owner; browser permission failures
 * wait for user activation. This panel neither owns XR nor repairs PC streaming.
 */
import type { XrSessionControl, XrSessionState } from "../../world/xr-contract";
import { requireElement, writeText } from "../shared/dom";
import { resolveStreamButton } from "./headset-button-state";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";

interface HeadsetPanelOptions {
  readonly parent: HTMLElement;
  readonly xr: Pick<XrSessionControl, "start" | "stop">;
  readonly signal: AbortSignal;
}

export function createHeadsetPanel({
  parent,
  xr,
  signal,
}: HeadsetPanelOptions): ConductorPanel & {
  readonly requestFromGesture: () => void;
} {
  const button = requireElement(
    parent,
    ".conductor__stream-button",
    HTMLButtonElement,
  );
  const label = requireElement(button, "[data-headset-label]", HTMLElement);
  let state: XrSessionState = {
    availability: "unknown",
    isSessionActive: false,
  };
  let wantsPicture = true;
  let pending = false;
  let needsGesture = false;
  let retryAt = 0;

  function requestFromGesture(): void {
    needsGesture = false;
    retryAt = 0;
    requestPicture();
  }

  function requestPicture(): void {
    if (signal.aborted || pending || !wantsPicture || needsGesture) return;
    if (state.isSessionActive || state.availability !== "available") return;
    if (performance.now() < retryAt) return;
    pending = true;
    void xr
      .start()
      .catch((reason: unknown) => {
        if (signal.aborted) return;
        needsGesture =
          reason instanceof DOMException &&
          (reason.name === "SecurityError" ||
            reason.name === "NotAllowedError");
        retryAt =
          performance.now() + CONDUCTOR_SETTINGS.headsetRetryMilliseconds;
        console.warn("The headset picture request failed.", reason);
      })
      .finally(() => {
        pending = false;
      });
  }

  function togglePicture(): void {
    if (pending || signal.aborted) return;
    if (!state.isSessionActive) {
      wantsPicture = true;
      requestFromGesture();
      return;
    }
    wantsPicture = false;
    pending = true;
    void xr
      .stop()
      .catch((reason: unknown) => {
        if (signal.aborted) return;
        wantsPicture = true;
        console.warn("The headset picture stop failed.", reason);
      })
      .finally(() => {
        pending = false;
      });
  }

  button.addEventListener("click", togglePicture, { signal });
  return {
    requestFromGesture,
    update(view): void {
      if (signal.aborted) return;
      if (state.isSessionActive && !view.xr.isSessionActive) {
        needsGesture = false;
        retryAt = 0;
      }
      state = view.xr;
      requestPicture();
      const resolved = resolveStreamButton(state);
      const text = pending
        ? state.isSessionActive
          ? "Picture: stopping"
          : "Picture: connecting"
        : needsGesture
          ? "Picture: click to retry"
          : resolved.label;
      writeText(label, text);
      button.disabled = pending || !resolved.isEnabled;
      button.dataset.streaming = String(state.isSessionActive);
      button.setAttribute("aria-pressed", String(state.isSessionActive));
      button.title = state.isSessionActive
        ? "Stop headset picture"
        : "Start headset picture";
    },
  };
}
