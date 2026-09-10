import type {
  XrAvailability,
  XrSessionControl,
  XrSessionState,
} from "./xr-contract";
/**
 * Purpose: Own WebXR availability and the immersive-vr session lifecycle.
 * Context: Pages start and stop the headset session from their own UI.
 * Responsibility: Track support and session state; start and end sessions.
 * Boundary: Buttons and every other surface around this contract live elsewhere.
 */

import type { WebGLRenderer } from "three";

// The floor reference keeps the visitor's height right when the runtime knows
// it; a runtime without it falls back to the default reference space.
const SESSION_INIT: XRSessionInit = { optionalFeatures: ["local-floor"] };

export function createXrSessionControl(
  renderer: WebGLRenderer,
): XrSessionControl {
  renderer.xr.enabled = true;

  const observers = new Set<(state: XrSessionState) => void>();
  let availability: XrAvailability = "unknown";
  let pendingStart: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let unloading: Promise<void> | undefined;

  function notify(): void {
    if (unloading) return;
    const state: XrSessionState = {
      availability,
      isSessionActive: renderer.xr.isPresenting,
    };
    for (const observer of observers) {
      observer(state);
    }
  }

  function setAvailability(next: XrAvailability): void {
    if (unloading || next === availability) return;

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

  renderer.xr.addEventListener("sessionstart", notify);
  renderer.xr.addEventListener("sessionend", notify);

  return {
    start: (): Promise<void> => {
      if (unloading || stopping) {
        return Promise.reject(new Error("XR control is ending"));
      }
      if (pendingStart) return pendingStart;
      if (renderer.xr.getSession() || !navigator.xr) return Promise.resolve();
      pendingStart = startSession(navigator.xr).finally(() => {
        pendingStart = undefined;
      });
      return pendingStart;
    },
    stop,
    unload: (): Promise<void> => {
      if (unloading) return unloading;
      unloading = stop();
      navigator.xr?.removeEventListener("devicechange", checkAvailability);
      renderer.xr.removeEventListener("sessionstart", notify);
      renderer.xr.removeEventListener("sessionend", notify);
      observers.clear();
      return unloading;
    },

    subscribe: (observer) => {
      if (unloading) return () => {};
      observers.add(observer);
      observer({ availability, isSessionActive: renderer.xr.isPresenting });
      return () => {
        observers.delete(observer);
      };
    },
  };

  async function startSession(system: XRSystem): Promise<void> {
    const session = await system.requestSession("immersive-vr", SESSION_INIT);
    if (unloading || stopping) {
      await session.end();
      return;
    }
    try {
      await renderer.xr.setSession(session);
    } catch (reason) {
      try {
        await session.end();
      } catch (endError) {
        throw new AggregateError(
          [reason, endError],
          "XR adoption and cleanup failed",
        );
      }
      throw reason;
    }
  }

  function stop(): Promise<void> {
    if (stopping) return stopping;
    stopping = (async () => {
      // setSession cannot be cancelled halfway through Three.js adoption.
      // Wait before ending it, so it cannot attach after the owner has ended.
      const started = await Promise.allSettled([pendingStart]);
      const session = renderer.xr.getSession();
      const errors: unknown[] = [];
      const result = started[0];
      if (result?.status === "rejected") errors.push(result.reason);
      try {
        await session?.end();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) throw new AggregateError(errors, "XR stop failed");
    })().finally(() => {
      stopping = undefined;
    });
    return stopping;
  }
}
