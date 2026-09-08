import { type ControlFrame, createNeutralControl } from "../control-frame";
import { M5_FIRMWARE_VERSION, type M5State } from "../protocol";
import { createAutoNeutralizer } from "./auto-neutralize";
import { protectControl } from "./control-safety";
import { createControlSmoother } from "./control-smoothing";
import { M5_SETTINGS } from "./m5-settings";

/** Device eligibility and freshness; effective steering quality lives in control. */
export type M5ConnectionStatus =
  | "connecting"
  | "live"
  | "missing-id"
  | "wrong-device"
  | "incompatible-firmware"
  | "uncalibrated"
  | "stalled";

export interface ControlSource {
  /** Accept only identified, compatible, calibrated and advancing samples. */
  readonly pushState: (state: M5State, nowMilliseconds: number) => void;
  /** Exactly one render-frame reader consumes pending button edges. */
  readonly consumeFrame: (nowMilliseconds: number) => ControlFrame;
  /** Observe one timestamp without consuming button events or changing state. */
  readonly readObservation: (nowMilliseconds: number) => {
    readonly status: M5ConnectionStatus;
    readonly sample: M5State | undefined;
    readonly control: Readonly<
      Pick<ControlFrame, "pitch" | "roll" | "quality">
    >;
  };
}

/** Compose derive → safety → neutralize → smooth once per accepted poll. */
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
  let deviceState: M5ConnectionStatus = expectedDeviceId.trim()
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

    readObservation(nowMilliseconds) {
      const live = isLive(nowMilliseconds);
      const { pitch, roll, quality } = live
        ? currentFrame
        : createNeutralControl();
      return {
        status: deviceState === "live" && !live ? "connecting" : deviceState,
        sample: live ? previousState : undefined,
        control: { pitch, roll, quality },
      };
    },
  };
}

/** First/reconnected samples establish counters without replaying old presses. */
function deriveControlFrame(
  previous: M5State | undefined,
  next: M5State,
): ControlFrame {
  return {
    pitch: next.pitch,
    roll: next.roll,
    quality: next.quality,
    buttonPressed: next.buttonPressed,
    buttonDown:
      previous !== undefined &&
      next.buttonPressCount > previous.buttonPressCount,
    buttonUp:
      previous !== undefined &&
      next.buttonReleaseCount > previous.buttonReleaseCount,
  };
}
