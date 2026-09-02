/**
 * Purpose: Compose polled device states into render-frame ControlFrames.
 * Context: Polls arrive at ~6Hz, the render loop reads at up to 90Hz; button
 *   edges and staleness must survive that mismatch, and a wrong device must
 *   warn rather than silently steer.
 * Responsibility: Run derive → safety → auto-neutralize → smooth per poll,
 *   latch button edges until the single reader consumes them, and report the
 *   operator-facing device state.
 * Boundary: Network IO lives in m5-adapter.ts. `readFrame` has exactly one
 *   caller — the level-runtime frame body — which is what makes consume-on-read
 *   edges safe; a second reader would steal edges. Other views read
 *   `readLatestState` instead.
 */

import { createAutoNeutralizer } from "./auto-neutralize";
import { type ControlFrame, createNeutralControl } from "./control-frame";
import { protectControl } from "./control-safety";
import { createControlSmoother } from "./control-smoothing";
import { M5_SETTINGS } from "./m5-settings";
import { M5_FIRMWARE_VERSION, type M5State } from "./protocol";
import { deriveControlFrame } from "./state-frames";

/** Operator-facing device state, published over the station link. */
export type M5DeviceState = "off" | "connecting" | "live" | "wrong-device";

export interface M5DeviceReport {
  readonly state: Exclude<M5DeviceState, "off">;
  readonly quality: number;
  readonly hasFirmwareMismatch: boolean;
}

export interface ControlSource {
  /** Feed one parsed poll result. Wrong-device states never steer. */
  readonly pushState: (state: M5State, nowMilliseconds: number) => void;
  /** Read the frame for this render frame. Consumes pending button edges. */
  readonly readFrame: (nowMilliseconds: number) => ControlFrame;
  readonly readDeviceReport: (nowMilliseconds: number) => M5DeviceReport;
  /**
   * The newest accepted poll, for a glanceable second reader. Undefined while
   * stale or wrong-device. It consumes no edges, which is what lets a view
   * other than the frame body read the device without stealing a press.
   */
  readonly readLatestState: (nowMilliseconds: number) => M5State | undefined;
}

export function createControlSource(
  expectedDeviceId: string = M5_SETTINGS.expectedDeviceId,
): ControlSource {
  const neutralizer = createAutoNeutralizer();
  const smoother = createControlSmoother();

  let previousState: M5State | undefined;
  let currentFrame = createNeutralControl();
  let lastAcceptedAtMilliseconds: number | null = null;
  let pendingButtonDown = false;
  let pendingButtonUp = false;
  let isWrongDevice = false;
  let hasFirmwareMismatch = false;

  const isStale = (nowMilliseconds: number): boolean =>
    lastAcceptedAtMilliseconds === null ||
    nowMilliseconds - lastAcceptedAtMilliseconds >
      M5_SETTINGS.staleAfterMilliseconds;

  return {
    pushState(state, nowMilliseconds) {
      hasFirmwareMismatch = state.firmwareVersion !== M5_FIRMWARE_VERSION;

      // A wrong or unknown device is an operator-visible warning — never
      // silent steering by the neighbour rig. Its counters are not tracked
      // either, so its button cannot fire edges.
      isWrongDevice =
        expectedDeviceId.length > 0 && state.deviceId !== expectedDeviceId;
      if (isWrongDevice) {
        return;
      }

      const derived = deriveControlFrame(previousState, state);
      previousState = state;
      lastAcceptedAtMilliseconds = nowMilliseconds;

      const safe = protectControl(currentFrame, derived);
      const neutralized = neutralizer.apply(safe, nowMilliseconds);
      // Skipping the smoother while pinned keeps "parked" from drifting.
      currentFrame = neutralizer.isHoldingZero()
        ? neutralized
        : smoother.apply(neutralized);

      pendingButtonDown ||= derived.buttonDown;
      pendingButtonUp ||= derived.buttonUp;
    },

    readFrame(nowMilliseconds) {
      const base = isStale(nowMilliseconds)
        ? createNeutralControl()
        : currentFrame;

      // Consume-on-read: an edge latched between polls is delivered exactly
      // once, even when the render loop runs many frames per poll — or when
      // the device went stale right after the press.
      const frame: ControlFrame = {
        ...base,
        buttonDown: pendingButtonDown,
        buttonUp: pendingButtonUp,
      };
      pendingButtonDown = false;
      pendingButtonUp = false;
      return frame;
    },

    readLatestState(nowMilliseconds) {
      if (isWrongDevice || isStale(nowMilliseconds)) return undefined;
      return previousState;
    },

    readDeviceReport(nowMilliseconds) {
      const stale = isStale(nowMilliseconds);
      return {
        state: isWrongDevice ? "wrong-device" : stale ? "connecting" : "live",
        quality: stale ? 0 : currentFrame.quality,
        hasFirmwareMismatch,
      };
    },
  };
}
