import { Quaternion, Vector3 } from "three";
import type { FlightControl, FlightInputSource } from "./control-contract";
import { FLIGHT_SETTINGS } from "./flight-settings";

interface FlightTransform {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

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
      const elapsedSeconds = validNonnegative(deltaSeconds);
      readCombinedInput(sources, combinedInput, elapsedSeconds);
      const distance =
        validNonnegative(glideSpeedMetersPerSecond) * elapsedSeconds;
      if (distance === 0) return;

      const pitch =
        -combinedInput.forwardTilt * FLIGHT_SETTINGS.maximumPitchRadians;
      const halfTurn =
        (-combinedInput.rightTilt *
          FLIGHT_SETTINGS.yawRateRadiansPerSecond *
          elapsedSeconds) /
        2;
      yawStep.setFromAxisAngle(worldUp, halfTurn);
      flight.quaternion.premultiply(yawStep).normalize();
      glideDirection.set(0, 0, -1).applyQuaternion(flight.quaternion);
      glideDirection.y = 0;
      glideDirection.normalize();

      // Integrate the circular arc at its midpoint, including its chord length.
      const chordScale = halfTurn === 0 ? 1 : Math.sin(halfTurn) / halfTurn;
      flight.position.addScaledVector(
        glideDirection,
        distance * Math.cos(pitch) * chordScale,
      );
      flight.position.y += distance * Math.sin(pitch);
      flight.quaternion.premultiply(yawStep).normalize();
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
  combined.forwardTilt = clampTilt(combined.forwardTilt);
  combined.rightTilt = clampTilt(combined.rightTilt);
}

function clampTilt(tilt: number): number {
  return Math.max(-1, Math.min(1, tilt));
}

function validNonnegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
