import { Quaternion, Vector3 } from "three";
import type { FlightControl, FlightInputSource } from "./control-contract";
import { FLIGHT_SETTINGS } from "./flight-settings";

interface FlightTransform {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

const MINIMUM_PLANAR_DIRECTION_LENGTH = 1e-6;

/** Own the only rig-mutating flight model and combine all connected sources. */
export function createFlightControl(
  flight: FlightTransform,
  sources: readonly FlightInputSource[],
): FlightControl {
  const worldUp = new Vector3(0, 1, 0);
  const yawStep = new Quaternion();
  const glideDirection = new Vector3();
  const combinedInput = { forwardTilt: 0, rightTilt: 0 };

  return {
    update(
      deltaSeconds,
      glideSpeedMetersPerSecond = FLIGHT_SETTINGS.glideSpeedMetersPerSecond,
    ): void {
      readCombinedInput(sources, combinedInput, deltaSeconds);
      yawStep.setFromAxisAngle(
        worldUp,
        -combinedInput.rightTilt *
          FLIGHT_SETTINGS.yawRateRadiansPerSecond *
          deltaSeconds,
      );
      flight.quaternion.premultiply(yawStep);

      glideDirection.set(0, 0, -1).applyQuaternion(flight.quaternion);
      glideDirection.y = 0;
      const planarLength = glideDirection.length();
      if (planarLength > MINIMUM_PLANAR_DIRECTION_LENGTH) {
        glideDirection.divideScalar(planarLength);
        flight.position.addScaledVector(
          glideDirection,
          glideSpeedMetersPerSecond * deltaSeconds,
        );
      }

      flight.position.y +=
        (-combinedInput.forwardTilt * FLIGHT_SETTINGS.climbRateMetersPerSecond -
          FLIGHT_SETTINGS.neutralDescentMetersPerSecond) *
        deltaSeconds;
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
    combined.forwardTilt += input.forwardTilt;
    combined.rightTilt += input.rightTilt;
  }
  combined.forwardTilt = clampTilt(combined.forwardTilt);
  combined.rightTilt = clampTilt(combined.rightTilt);
}

function clampTilt(tilt: number): number {
  return Math.max(-1, Math.min(1, tilt));
}
