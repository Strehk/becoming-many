import { Vector3 } from "three";
import { FLIGHT_SETTINGS } from "../../control/flight-settings";
import type { Viewpoint } from "../../world/viewer-rig";
import { START_SETTINGS } from "./start-settings";

/** Read-only borrowed motion samples; vectors remain valid until the next update or reset. */
export type StartMotion = Pick<
  ReturnType<typeof createStartMotion>,
  "direction" | "curvature" | "speed" | "predictPosition"
>;

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
  let hasMotionHistory = false;

  return {
    direction: currentTravelDirection,
    curvature,
    get speed() {
      return observedSpeed;
    },
    resetHistory,
    update,
    predictPosition,
  };

  function resetHistory(): void {
    observedSpeed = 0;
    hasMotionHistory = false;
    curvature.set(0, 0, 0);
    currentTravelDirection.copy(
      viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
    );
  }

  function update(flightTravel: Vector3, elapsed: number): void {
    if (elapsed <= 0) return;
    if (
      flightTravel.lengthSq() <= START_SETTINGS.minimumTravelSquared ||
      flightTravel.length() / elapsed >
        START_SETTINGS.maximumObservedSpeedMetersPerSecond
    ) {
      hasMotionHistory = false;
      curvature.set(0, 0, 0);
      currentTravelDirection.copy(
        viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
      );
      return;
    }
    currentTravelDirection.copy(flightTravel).normalize();
    const smoothing =
      1 - Math.exp(-elapsed / START_SETTINGS.motionHistorySeconds);
    const speed = flightTravel.length() / elapsed;
    observedSpeed = hasMotionHistory
      ? observedSpeed + (speed - observedSpeed) * smoothing
      : speed;
    if (hasMotionHistory && elapsed <= START_SETTINGS.motionHistorySeconds) {
      sampledCurvature
        .copy(currentTravelDirection)
        .sub(previousTravelDirection)
        .multiplyScalar(1 / flightTravel.length());
      // Only sideways change bends the prediction; speed remains Run-owned.
      sampledCurvature.addScaledVector(
        currentTravelDirection,
        -sampledCurvature.dot(currentTravelDirection),
      );
      const curvatureLimit = Math.min(
        START_SETTINGS.maximumCurvaturePerMeter,
        FLIGHT_SETTINGS.yawRateRadiansPerSecond / Math.max(observedSpeed, 0.1),
      );
      const magnitude = sampledCurvature.length();
      if (magnitude > curvatureLimit)
        sampledCurvature.multiplyScalar(curvatureLimit / magnitude);
      curvature.lerp(sampledCurvature, smoothing);
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
    const decay = Math.exp(-distance / START_SETTINGS.curvatureDecayMeters);
    position
      .copy(origin)
      .addScaledVector(currentTravelDirection, distance)
      .addScaledVector(
        curvature,
        START_SETTINGS.curvatureDecayMeters * distance -
          START_SETTINGS.curvatureDecayMeters ** 2 * (1 - decay),
      );
    tangent
      .copy(currentTravelDirection)
      .addScaledVector(
        curvature,
        START_SETTINGS.curvatureDecayMeters * (1 - decay),
      );
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
