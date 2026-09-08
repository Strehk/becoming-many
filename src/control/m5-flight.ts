/**
 * Purpose: Apply an M5 control frame to the viewer rig as ICAROS glider flight.
 * Context: The rig flies a level glider: constant forward glide, roll steers
 *   the heading, pitch climbs or descends — the horizon never banks and the
 *   view never pitches with altitude.
 * Responsibility: Integrate yaw, glide, and biased climb from one frame using
 *   the shared flight tuning and the single steering polarity flip.
 * Boundary: Frame production, safety, and precedence over the keyboard live
 *   elsewhere; ground clearance clamps afterward in the frame body.
 */

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

const flightInput: FlightInput = { turnRight: 0, climb: 0 };
const WORLD_UP = new Vector3(0, 1, 0);
const LOCAL_FORWARD = new Vector3(0, 0, -1);
const MINIMUM_PLANAR_DIRECTION_LENGTH = 1e-6;
const yawStep = new Quaternion();
const glideDirection = new Vector3();

export function applyM5Flight(
  flight: FlightTransform,
  frame: ControlFrame,
  deltaSeconds: number,
): void {
  readM5FlightInput(frame, flightInput);

  // Yaw about world-up, never a tilted local axis: the heading persists after
  // the roll returns to zero and the horizon can never bank. Pre-multiplying
  // keeps the heading in world space; local headset or mouse look stays
  // independent on the child camera.
  yawStep.setFromAxisAngle(
    WORLD_UP,
    -flightInput.turnRight *
      FLIGHT_SETTINGS.yawRateRadiansPerSecond *
      deltaSeconds,
  );
  flight.quaternion.premultiply(yawStep);

  // The rig's local -Z is the glider heading. Headset and mouse look live on
  // the child camera, so looking aside never steers the flight.
  glideDirection.copy(LOCAL_FORWARD).applyQuaternion(flight.quaternion);
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
}
