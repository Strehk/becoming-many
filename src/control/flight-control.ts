import { Euler, type Quaternion, Vector3 } from "three";
import type { FlightControl, FlightInputSource } from "./control-contract";
import { FLIGHT_SETTINGS } from "./flight-settings";

interface FlightTransform {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

/** Own body orientation and travel; local mouse/head pose never enters flight. */
export function createFlightControl(
  flight: FlightTransform,
  sources: readonly FlightInputSource[],
): FlightControl {
  const orientation = new Euler(0, 0, 0, "YXZ");
  const direction = new Vector3();
  const input = { forwardTilt: 0, rightTilt: 0 };

  return {
    update(
      deltaSeconds,
      glideSpeedMetersPerSecond = FLIGHT_SETTINGS.glideSpeedMetersPerSecond,
      isPresentingXr = false,
    ): void {
      const elapsed = validNonnegative(deltaSeconds);
      readCombinedInput(sources, input, elapsed);
      const distance = validNonnegative(glideSpeedMetersPerSecond) * elapsed;
      if (distance === 0) return;
      orientation.setFromQuaternion(flight.quaternion, "YXZ");
      orientation.x = -input.forwardTilt * FLIGHT_SETTINGS.maximumPitchRadians;
      orientation.z = -input.rightTilt * FLIGHT_SETTINGS.maximumBankRadians;
      orientation.y -=
        input.rightTilt * FLIGHT_SETTINGS.yawRateRadiansPerSecond * elapsed;
      direction.set(0, 0, -1).applyEuler(orientation);
      flight.position.addScaledVector(direction, distance);
      // Physical head tracking already includes body pitch and bank in XR.
      if (isPresentingXr) orientation.x = orientation.z = 0;
      flight.quaternion.setFromEuler(orientation);
    },
  };
}

function readCombinedInput(
  sources: readonly FlightInputSource[],
  combined: { forwardTilt: number; rightTilt: number },
  deltaSeconds: number,
): void {
  combined.forwardTilt = 0;
  combined.rightTilt = 0;
  for (const source of sources) {
    const input = source.readInput(deltaSeconds);
    combined.forwardTilt += Number.isFinite(input.forwardTilt)
      ? input.forwardTilt
      : 0;
    combined.rightTilt += Number.isFinite(input.rightTilt)
      ? input.rightTilt
      : 0;
  }
  combined.forwardTilt = Math.max(-1, Math.min(1, combined.forwardTilt));
  combined.rightTilt = Math.max(-1, Math.min(1, combined.rightTilt));
}

function validNonnegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
