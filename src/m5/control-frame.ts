/**
 * Purpose: Define the normalized controller state every steering consumer reads.
 * Context: The M5 adapter is one device adapter beside desktop; this is the one
 *   controller shape that leaves it (proven contract from the previous stack).
 * Responsibility: Own the ControlFrame type and its neutral value.
 * Boundary: How a frame is produced (polling, pipeline) and what it steers live
 *   elsewhere.
 */

/** Normalized controller state. The only controller shape that leaves the adapter. */
export interface ControlFrame {
  /** Forward-positive inclination, -1..1, preserving M5State.pitch. */
  readonly pitch: number;
  /** Right-positive inclination, -1..1, preserving M5State.roll. */
  readonly roll: number;
  /** Effective input availability, 0..1. **0 means "neutral", not "broken"** — see `createNeutralControl`. */
  readonly quality: number;
  readonly buttonPressed: boolean;
  /** True on the single frame the button went down. */
  readonly buttonDown: boolean;
  /** True on the single frame the button came back up. */
  readonly buttonUp: boolean;
}

/**
 * The at-rest control. Published whenever input is missing or stale — `quality: 0` is the caller's cue that nothing is steering, and is
 * a normal operating state (keyboard control, no device configured), not an
 * error.
 */
export function createNeutralControl(): ControlFrame {
  return {
    pitch: 0,
    roll: 0,
    quality: 0,
    buttonPressed: false,
    buttonDown: false,
    buttonUp: false,
  };
}
