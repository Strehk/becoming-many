import { Quaternion, Vector3 } from "three";
import type { ControlFrame } from "../m5/control-frame";
import { FLIGHT_SETTINGS } from "./flight-settings";

/** The locomotion transform owned by the flight model. */
interface FlightTransform {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

const MINIMUM_PLANAR_DIRECTION_LENGTH = 1e-6;

/** Own reusable flight math for one rig; no timers or external resources. */
export function createM5Flight(
  flight: FlightTransform,
): (frame: ControlFrame, deltaSeconds: number) => void {
  const worldUp = new Vector3(0, 1, 0);
  const yawStep = new Quaternion();
  const glideDirection = new Vector3();

  return (frame, deltaSeconds): void => {
    const turnRight = -frame.roll;
    const climb = -frame.pitch;
    // World-up yaw preserves a level horizon and independent local head pose.
    yawStep.setFromAxisAngle(
      worldUp,
      -turnRight * FLIGHT_SETTINGS.yawRateRadiansPerSecond * deltaSeconds,
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
      climb * FLIGHT_SETTINGS.climbRateMetersPerSecond -
      FLIGHT_SETTINGS.neutralDescentMetersPerSecond;
    flight.position.y += verticalSpeedMetersPerSecond * deltaSeconds;
  };
}
