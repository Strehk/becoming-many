import { type ControlFrame, createNeutralControl } from "../control-frame";
import type { M5State } from "../protocol";
import { createAutoNeutralizer } from "./auto-neutralize";
import { createControlSmoother } from "./control-smoothing";
import { M5_SETTINGS } from "./m5-settings";

/** Connection freshness; metadata never blocks the configured host. */
export type M5ConnectionStatus = "connecting" | "live";

export interface ControlSource {
  /** Accept every parsed response from the configured host. */
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

/** Compose button edges, rest-pose neutralization and smoothing per poll. */
export function createControlSource(): ControlSource {
  const neutralizer = createAutoNeutralizer();
  const smoother = createControlSmoother();

  let previousState: M5State | undefined;
  let currentFrame = createNeutralControl();
  let lastAcceptedAtMilliseconds: number | null = null;
  let pendingButtonDown = false;
  let pendingButtonUp = false;
  const isLive = (nowMilliseconds: number): boolean =>
    lastAcceptedAtMilliseconds !== null &&
    nowMilliseconds - lastAcceptedAtMilliseconds <=
      M5_SETTINGS.staleAfterMilliseconds;

  return {
    pushState(state, nowMilliseconds) {
      const wasLive = isLive(nowMilliseconds);
      if (!wasLive) {
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
      previousState = state;
      lastAcceptedAtMilliseconds = nowMilliseconds;

      const neutralized = neutralizer.apply(derived, nowMilliseconds);
      // Skipping the smoother while pinned keeps "parked" from drifting.
      currentFrame = neutralizer.isHoldingZero()
        ? neutralized
        : smoother.apply(neutralized);

      pendingButtonDown ||= derived.buttonDown;
      pendingButtonUp ||= derived.buttonUp;
    },

    consumeFrame(nowMilliseconds) {
      const live = isLive(nowMilliseconds);
      // Only current edges reach the single reader, exactly once.
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
        status: live ? "live" : "connecting",
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
    // A fresh parsed reply supplies steering; device quality stays diagnostic.
    quality: 1,
    buttonPressed: next.buttonPressed,
    buttonDown:
      previous !== undefined &&
      next.buttonPressCount > previous.buttonPressCount,
    buttonUp:
      previous !== undefined &&
      next.buttonReleaseCount > previous.buttonReleaseCount,
  };
}
