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
  /** End this owner, including pending session requests and every listener. */
  readonly unload: () => Promise<void>;
  /** Calls the observer immediately and on every change; returns unsubscribe. */
  readonly subscribe: (observer: (state: XrSessionState) => void) => () => void;
}
