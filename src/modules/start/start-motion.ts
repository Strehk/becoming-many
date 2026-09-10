import { Vector3 } from "three";
import { FLIGHT_SETTINGS } from "../../control/flight-settings";
import type { Viewpoint } from "../../world/viewer-rig";

export const MINIMUM_TRAVEL_SQUARED = 0.000001;
const MOTION_HISTORY_SECONDS = 0.25;
const MAXIMUM_CURVATURE_PER_METER = 0.12;
export const CURVATURE_DECAY_METERS = 4;
const MAXIMUM_OBSERVED_SPEED_METERS_PER_SECOND = 12;

/** Bounded flight-only history; callers supply movement and playing time, never eye rotation. */
export function createStartMotion(
  viewpoint: Viewpoint,
  maximumGoalYAt?: (x: number, z: number) => number,
) {
  const previousTravelDirection = new Vector3();
  const curvature = new Vector3();
  const sampledCurvature = new Vector3();
  const currentTravelDirection = new Vector3();
  let observedSpeed = 0;
  let directionVariation = 0;
  let hasMotionHistory = false;

  return {
    direction: currentTravelDirection,
    curvature,
    get speed() {
      return observedSpeed;
    },
    get directionVariation() {
      return directionVariation;
    },
    reset,
    update,
    predictPosition,
  };

  function reset(): void {
    observedSpeed = 0;
    directionVariation = 0;
    hasMotionHistory = false;
    curvature.set(0, 0, 0);
    currentTravelDirection.copy(
      viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
    );
  }

  function update(flightTravel: Vector3, elapsed: number): void {
    if (elapsed <= 0) return;
    if (
      flightTravel.lengthSq() <= MINIMUM_TRAVEL_SQUARED ||
      flightTravel.length() / elapsed > MAXIMUM_OBSERVED_SPEED_METERS_PER_SECOND
    ) {
      hasMotionHistory = false;
      curvature.set(0, 0, 0);
      currentTravelDirection.copy(
        viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
      );
      return;
    }
    currentTravelDirection.copy(flightTravel).normalize();
    const smoothing = 1 - Math.exp(-elapsed / MOTION_HISTORY_SECONDS);
    const speed = flightTravel.length() / elapsed;
    observedSpeed = hasMotionHistory
      ? observedSpeed + (speed - observedSpeed) * smoothing
      : speed;
    if (hasMotionHistory && elapsed <= MOTION_HISTORY_SECONDS) {
      sampledCurvature
        .copy(currentTravelDirection)
        .sub(previousTravelDirection)
        .multiplyScalar(1 / flightTravel.length());
      // Only sideways change bends the prediction; speed remains Run-owned.
      sampledCurvature.addScaledVector(
        currentTravelDirection,
        -sampledCurvature.dot(currentTravelDirection),
      );
      const variation = currentTravelDirection.angleTo(previousTravelDirection);
      directionVariation += (variation - directionVariation) * smoothing;
      const curvatureLimit = Math.min(
        MAXIMUM_CURVATURE_PER_METER,
        FLIGHT_SETTINGS.yawRateRadiansPerSecond / Math.max(observedSpeed, 0.1),
      );
      const magnitude = sampledCurvature.length();
      if (magnitude > curvatureLimit)
        sampledCurvature.multiplyScalar(curvatureLimit / magnitude);
      curvature.lerp(
        sampledCurvature,
        1 - Math.exp(-elapsed / MOTION_HISTORY_SECONDS),
      );
      curvature.addScaledVector(
        currentTravelDirection,
        -curvature.dot(currentTravelDirection),
      );
    } else curvature.set(0, 0, 0);
    previousTravelDirection.copy(currentTravelDirection);
    hasMotionHistory = true;
  }

  /** Integrate a decaying turn trend; remote predictions gradually straighten. */
  function predictPosition(
    origin: Readonly<Vector3>,
    distance: number,
    position: Vector3,
    tangent: Vector3,
  ): void {
    const decay = Math.exp(-distance / CURVATURE_DECAY_METERS);
    position
      .copy(origin)
      .addScaledVector(currentTravelDirection, distance)
      .addScaledVector(
        curvature,
        CURVATURE_DECAY_METERS * distance -
          CURVATURE_DECAY_METERS ** 2 * (1 - decay),
      );
    tangent
      .copy(currentTravelDirection)
      .addScaledVector(curvature, CURVATURE_DECAY_METERS * (1 - decay));
    if (maximumGoalYAt) {
      const ceiling = maximumGoalYAt(position.x, position.z);
      if (position.y > ceiling) {
        position.y = ceiling;
        tangent.y = 0;
      }
    }
    tangent.normalize();
  }
}
