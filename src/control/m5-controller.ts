import type { ControlFrame } from "../m5/control-frame";
import type { FlightInputSource } from "./control-contract";

interface M5FlightFrames {
  /** Undefined without a configured host; stale configured input is neutral. */
  readonly consumeFrame: () => ControlFrame | undefined;
}

/** Translate normalized M5 axes into the shared semantic flight input. */
export function createM5Controller(frames: M5FlightFrames): FlightInputSource {
  const input = { forwardTilt: 0, rightTilt: 0 };
  return {
    readInput() {
      const frame = frames.consumeFrame();
      input.forwardTilt = frame?.pitch ?? 0;
      // Preserve the established M5 flight polarity at this single adapter.
      input.rightTilt = !frame || frame.roll === 0 ? 0 : -frame.roll;
      return input;
    },
  };
}
