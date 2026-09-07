/**
 * Purpose: Compose polled device states into render-frame ControlFrames.
 * Context: Polls arrive at ~6Hz, the render loop reads at up to 90Hz; button
 *   edges and staleness must survive that mismatch, and a wrong device must
 *   warn rather than silently steer.
 * Responsibility: Run derive → safety → auto-neutralize → smooth per poll,
 *   latch button edges until the single reader consumes them, and report the
 *   operator-facing device state.
 * Boundary: Network IO lives in m5-adapter.ts. `consumeFrame` has exactly one
 *   caller — the level.runtime frame body — which is what makes consume-on-read
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

/** Operator-facing device state read by the page that owns the adapter. */
type M5DeviceState =
  | "connecting"
  | "live"
  | "missing-id"
  | "wrong-device"
  | "incompatible-firmware"
  | "uncalibrated"
  | "stalled";

export interface M5DeviceReport {
  readonly state: M5DeviceState;
  readonly quality: number;
}

export interface ControlSource {
  /** Accept only identified, compatible, calibrated and advancing samples. */
  readonly pushState: (state: M5State, nowMilliseconds: number) => void;
  /** Read the frame for this render frame. Consumes pending button edges. */
  readonly consumeFrame: (nowMilliseconds: number) => ControlFrame;
  readonly readDeviceReport: (nowMilliseconds: number) => M5DeviceReport;
  /**
   * The newest accepted poll, for a glanceable second reader. Undefined while
   * stale or rejected. It consumes no edges, which is what lets a view
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
  let deviceState: M5DeviceReport["state"] = expectedDeviceId.trim()
    ? "connecting"
    : "missing-id";

  const isLive = (nowMilliseconds: number): boolean =>
    deviceState === "live" &&
    lastAcceptedAtMilliseconds !== null &&
    nowMilliseconds - lastAcceptedAtMilliseconds <=
      M5_SETTINGS.staleAfterMilliseconds;

  return {
    pushState(state, nowMilliseconds) {
      const wasLive = isLive(nowMilliseconds);
      deviceState = "live";
      if (!expectedDeviceId.trim()) deviceState = "missing-id";
      else if (state.deviceId !== expectedDeviceId)
        deviceState = "wrong-device";
      else if (state.firmwareVersion !== M5_FIRMWARE_VERSION)
        deviceState = "incompatible-firmware";
      else if (!state.isCalibrated) deviceState = "uncalibrated";
      else if (
        previousState &&
        (state.seq <= previousState.seq ||
          state.uptimeMs < previousState.uptimeMs)
      )
        deviceState = "stalled";

      if (!wasLive || deviceState !== "live") {
        currentFrame = smoother.apply(
          neutralizer.apply(createNeutralControl(), nowMilliseconds),
        );
        pendingButtonDown = false;
        pendingButtonUp = false;
      }

      const derived = deriveControlFrame(
        wasLive ? previousState : undefined,
        state,
      );
      // Only an uptime reset establishes a lower sequence baseline. Replayed
      // or frozen counters must not lower the last accepted sequence.
      if (
        deviceState === "live" ||
        (deviceState === "stalled" &&
          previousState &&
          state.uptimeMs < previousState.uptimeMs)
      )
        previousState = state;
      if (deviceState !== "live") return;
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

    consumeFrame(nowMilliseconds) {
      const live = isLive(nowMilliseconds);
      // Only trusted, fresh edges reach the single reader, exactly once.
      const frame: ControlFrame = {
        ...(live ? currentFrame : createNeutralControl()),
        buttonDown: live && pendingButtonDown,
        buttonUp: live && pendingButtonUp,
      };
      pendingButtonDown = false;
      pendingButtonUp = false;
      return frame;
    },

    readLatestState(nowMilliseconds) {
      return isLive(nowMilliseconds) ? previousState : undefined;
    },

    readDeviceReport(nowMilliseconds) {
      const live = isLive(nowMilliseconds);
      return {
        state: deviceState === "live" && !live ? "connecting" : deviceState,
        quality: live ? currentFrame.quality : 0,
      };
    },
  };
}
