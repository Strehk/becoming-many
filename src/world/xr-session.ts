/**
 * Purpose: Own WebXR availability and the immersive-vr session lifecycle.
 * Context: Pages start and stop the headset session from their own UI.
 * Responsibility: Track support and session state; start and end sessions.
 * Boundary: Buttons and every other surface around this contract live elsewhere.
 */

import type { WebGLRenderer } from "three";

export type XrAvailability = "unknown" | "unsupported" | "available";

export interface XrSessionState {
  readonly availability: XrAvailability;
  readonly isSessionActive: boolean;
}

export interface XrSessionControl {
  /** Request an immersive-vr session and hand it to the renderer. */
  readonly start: () => Promise<void>;
  /** End the active session; resolves once it has ended. No session is fine. */
  readonly stop: () => Promise<void>;
  /** Calls the observer immediately and on every change; returns unsubscribe. */
  readonly subscribe: (observer: (state: XrSessionState) => void) => () => void;
}

// The floor reference keeps the visitor's height right when the runtime knows
// it; a runtime without it falls back to the default reference space.
const SESSION_INIT: XRSessionInit = { optionalFeatures: ["local-floor"] };

export function createXrSessionControl(
  renderer: WebGLRenderer,
): XrSessionControl {
  renderer.xr.enabled = true;

  const observers = new Set<(state: XrSessionState) => void>();
  let availability: XrAvailability = "unknown";
  let isSessionActive = false;

  function notify(): void {
    const state: XrSessionState = { availability, isSessionActive };
    for (const observer of observers) {
      observer(state);
    }
  }

  // Availability is re-checked whenever the runtime reports a device change,
  // so plugging in a headset or starting the streaming runtime flips the
  // state without a reload.
  function checkAvailability(): void {
    if (!navigator.xr) {
      availability = "unsupported";
      notify();
      return;
    }

    navigator.xr.isSessionSupported("immersive-vr").then(
      (isSupported) => {
        availability = isSupported ? "available" : "unsupported";
        notify();
      },
      () => {
        availability = "unsupported";
        notify();
      },
    );
  }

  checkAvailability();
  navigator.xr?.addEventListener("devicechange", checkAvailability);

  renderer.xr.addEventListener("sessionstart", () => {
    isSessionActive = true;
    notify();
  });
  renderer.xr.addEventListener("sessionend", () => {
    isSessionActive = false;
    notify();
  });

  return {
    start: async (): Promise<void> => {
      if (renderer.xr.getSession() || !navigator.xr) return;

      const session = await navigator.xr.requestSession(
        "immersive-vr",
        SESSION_INIT,
      );
      await renderer.xr.setSession(session);
    },

    stop: async (): Promise<void> => {
      await renderer.xr.getSession()?.end();
    },

    subscribe: (observer) => {
      observers.add(observer);
      observer({ availability, isSessionActive });
      return () => {
        observers.delete(observer);
      };
    },
  };
}
