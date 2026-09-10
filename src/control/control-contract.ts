import type { ControlFrame } from "../m5/control-frame";

export interface DesktopControls {
  readonly update: (
    deltaSeconds: number,
    movementSpeedMetersPerSecond?: number,
  ) => void;
  /** Ends input capture and awaits any pending pointer-lock grant and release. */
  readonly unload: () => Promise<void>;
}

/** Applies one consumed controller sample to the borrowed locomotion rig. */
export type M5Flight = (
  frame: ControlFrame,
  deltaSeconds: number,
  glideSpeedMetersPerSecond?: number,
) => void;
