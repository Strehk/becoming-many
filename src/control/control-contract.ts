/** Normalized controller tilt; positive values lean forward and right. */
export interface FlightInput {
  readonly forwardTilt: number;
  readonly rightTilt: number;
}

/**
 * Read one borrowed input sample in the range -1..1 per axis. Disconnected or
 * stale controllers return neutral axes. Physical inputs report current tilt;
 * the keyboard advances its emulated tilt by the supplied frame time in seconds.
 * Call once per flight frame. The borrowed sample lasts until the next read.
 */
export interface FlightInputSource {
  readonly readInput: (deltaSeconds: number) => Readonly<FlightInput>;
}

export interface FlightControl {
  /**
   * Integrate body-relative flight at a speed along the path in metres/second.
   * Forward tilt pitches down; right tilt banks right and turns the heading.
   * Neutral flies level. XR leaves physical pitch/bank to headset tracking.
   * Invalid/nonpositive time or speed leaves the rig unchanged. Source state
   * still advances once per valid frame.
   */
  readonly update: (
    deltaSeconds: number,
    glideSpeedMetersPerSecond?: number,
    isPresentingXr?: boolean,
  ) => void;
}

export interface DesktopController extends FlightInputSource {
  /** Ends input capture and awaits any pending pointer-lock grant and release. */
  readonly unload: () => Promise<void>;
}
