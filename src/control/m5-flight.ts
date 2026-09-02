/**
 * Purpose: Apply an M5 control frame to the camera as ICAROS glider flight.
 * Context: The rig flies a level glider: constant forward glide, roll steers
 *   the heading, pitch climbs or descends — the horizon never banks and the
 *   view never pitches with altitude.
 * Responsibility: Integrate yaw, glide, and climb from one frame; own the
 *   flight-rate constants and the single steering polarity flip.
 * Boundary: Frame production, safety, and precedence over the keyboard live
 *   elsewhere; ground clearance clamps afterward in the frame body.
 */

import { type Camera, Quaternion, Vector3 } from "three";
import type { ControlFrame } from "../m5/control-frame";

// World units per second of forward glide. Halved from the desktop
// MOVEMENT_SPEED after flying it: the piece wants a drift, not a rush.
const GLIDE_SPEED = 10;
// World units per second of climb or descent at full pitch deflection.
const CLIMB_RATE = 10;
// Radians per second of heading change at full roll deflection.
const YAW_RATE = 0.8;

const WORLD_UP = new Vector3(0, 1, 0);
const yawStep = new Quaternion();
const glideDirection = new Vector3();

export function applyM5Flight(
  camera: Camera,
  frame: ControlFrame,
  deltaSeconds: number,
): void {
  // Steering polarity, fixed once here for every source that may join later:
  // the rig reads inverted on both axes against the frame convention, so
  // pull-back climbs and lean-left turns left. The axes are not swapped.
  const steeringPitch = -frame.pitch;
  const steeringRoll = -frame.roll;

  // Yaw about world-up, never a tilted local axis: the heading persists after
  // the roll returns to zero and the horizon can never bank. Pre-multiplying
  // composes cleanly with PointerLockControls, which re-reads the camera
  // quaternion into a YXZ euler on every mouse move.
  yawStep.setFromAxisAngle(WORLD_UP, -steeringRoll * YAW_RATE * deltaSeconds);
  camera.quaternion.premultiply(yawStep);

  // Glide along the level projection of the view direction; altitude is owned
  // by the climb rate below, so looking down does not dive the flight.
  camera.getWorldDirection(glideDirection);
  glideDirection.y = 0;
  const planarLength = glideDirection.length();
  if (planarLength > 1e-6) {
    glideDirection.divideScalar(planarLength);
    camera.position.addScaledVector(glideDirection, GLIDE_SPEED * deltaSeconds);
  }

  camera.position.y += steeringPitch * CLIMB_RATE * deltaSeconds;
}
