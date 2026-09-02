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

  function setAvailability(next: XrAvailability): void {
    if (next === availability) return;

    availability = next;
    console.info(`XR: immersive-vr is ${next}.`);
    notify();
  }

  // Availability is re-checked whenever the runtime reports a device change,
  // so plugging in a headset or starting the streaming runtime flips the
  // state without a reload.
  function checkAvailability(): void {
    if (!navigator.xr) {
      setAvailability("unsupported");
      return;
    }

    navigator.xr.isSessionSupported("immersive-vr").then(
      (isSupported) =>
        setAvailability(isSupported ? "available" : "unsupported"),
      () => setAvailability("unsupported"),
    );
  }

  checkAvailability();
  navigator.xr?.addEventListener("devicechange", checkAvailability);

  renderer.xr.addEventListener("sessionstart", () => {
    isSessionActive = true;
    console.info("XR: the renderer is presenting to the headset.");
    notify();
  });
  renderer.xr.addEventListener("sessionend", () => {
    isSessionActive = false;
    console.info("XR: the session ended.");
    notify();
  });

  return {
    start: async (): Promise<void> => {
      if (renderer.xr.getSession() || !navigator.xr) return;

      console.info("XR: requesting an immersive-vr session.");
      const session = await navigator.xr.requestSession(
        "immersive-vr",
        SESSION_INIT,
      );

      // The runtime presents this session from here on, and shows the visitor
      // a black room until something draws into it. A renderer that cannot
      // adopt it must therefore not leave it open: without this the headset
      // stays black until the page dies, while the page itself looks idle.
      console.info("XR: session granted; handing it to the renderer.");
      try {
        await renderer.xr.setSession(session);
      } catch (reason) {
        console.error("XR: the renderer could not adopt the session.", reason);
        // Ending a doomed session can fail in its own right; the refusal above
        // is the reason worth reporting.
        await session.end().catch(() => undefined);
        throw reason;
      }
    },

    stop: async (): Promise<void> => {
      const session = renderer.xr.getSession();
      if (!session) return;

      console.info("XR: ending the session.");
      await session.end();
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
