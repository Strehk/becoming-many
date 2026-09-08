import { Quaternion, Vector3 } from "three";
import type { ControlFrame } from "../m5/control-frame";
import { FLIGHT_SETTINGS } from "./flight-settings";

/** The locomotion transform owned by the flight model. */
interface FlightTransform {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

/** Semantic steering shared by flight and input-driven content. */
export interface FlightInput {
  turnRight: number;
  climb: number;
}

/** Translate calibrated axes without allocation; validity remains owned by M5. */
export function readM5FlightInput(
  frame: ControlFrame,
  target: FlightInput,
): void {
  target.turnRight = -frame.roll;
  target.climb = -frame.pitch;
}

const MINIMUM_PLANAR_DIRECTION_LENGTH = 1e-6;

/** Own reusable flight math for one rig; no timers or external resources. */
export function createM5Flight(
  flight: FlightTransform,
): (frame: ControlFrame, deltaSeconds: number) => void {
  const flightInput: FlightInput = { turnRight: 0, climb: 0 };
  const worldUp = new Vector3(0, 1, 0);
  const yawStep = new Quaternion();
  const glideDirection = new Vector3();

  return (frame, deltaSeconds): void => {
    readM5FlightInput(frame, flightInput);
    // World-up yaw preserves a level horizon and independent local head pose.
    yawStep.setFromAxisAngle(
      worldUp,
      -flightInput.turnRight *
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
        FLIGHT_SETTINGS.glideSpeedMetersPerSecond * deltaSeconds,
      );
    }

    const verticalSpeedMetersPerSecond =
      flightInput.climb * FLIGHT_SETTINGS.climbRateMetersPerSecond -
      FLIGHT_SETTINGS.neutralDescentMetersPerSecond;
    flight.position.y += verticalSpeedMetersPerSecond * deltaSeconds;
  };
}
