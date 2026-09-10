/** Normalized controller tilt; positive values lean forward and right. */
export interface FlightInput {
  readonly forwardTilt: number;
  readonly rightTilt: number;
}

/**
 * Read one borrowed input sample in the range -1..1 per axis. Disconnected or
 * stale controllers return neutral axes. `deltaSeconds` is elapsed frame time;
 * stateful sources treat invalid values as zero. The sample lasts for this read.
 */
export interface FlightInputSource {
  readonly readInput: (deltaSeconds: number) => Readonly<FlightInput>;
}

export interface FlightControl {
  /** Combine connected sources and integrate one flight step on the rig. */
  readonly update: (
    deltaSeconds: number,
    glideSpeedMetersPerSecond?: number,
  ) => void;
}

export interface DesktopController extends FlightInputSource {
  /** Ends input capture and awaits any pending pointer-lock grant and release. */
  readonly unload: () => Promise<void>;
}
