import { CubicBezierCurve3, Quaternion, Vector3 } from "three";
import { FLIGHT_SETTINGS } from "../../control/flight-settings";
import type { Viewpoint } from "../../world/viewer-rig";
import type { StartMotion } from "./start-motion";
import { START_PARTICLE_SETTINGS } from "./start-particle-settings";
import type {
  DistanceRange,
  StartDirection,
  StartParameters,
} from "./start-settings";
import { START_SETTINGS } from "./start-settings";

const WORLD_UP = new Vector3(0, 1, 0);

/** Owns fixed cue/tunnel geometry and reusable samples; Start owns phases and preview passage ages. */
export function createStartCourse(
  parameters: StartParameters,
  viewpoint: Viewpoint,
  motion: StartMotion,
  random: () => number,
  maximumGoalYAt?: (x: number, z: number) => number,
) {
  const arrowLengthMeters =
    parameters.particles?.arrowLengthMeters ??
    START_PARTICLE_SETTINGS.arrowLengthMeters;
  const origin = new Vector3();
  const predictedTangent = new Vector3();
  const tunnelEntry = new Vector3();
  const approachCurve = new CubicBezierCurve3();
  const tunnelCurve = new CubicBezierCurve3();
  const goalUp = new Vector3();
  const lessonBend = new Vector3();
  const transportRotation = new Quaternion();
  const courseSamples = Array.from(
    { length: START_SETTINGS.courseSampleCount + 1 },
    () => ({
      position: new Vector3(),
      tangent: new Vector3(),
      up: new Vector3(),
      distance: 0,
    }),
  );
  const arrowPosition = new Vector3();
  const arrowNormal = new Vector3();
  const arrowDirection = new Vector3();
  const arrowUp = new Vector3();
  const approachDirection = new Vector3();
  const turnDirection = new Vector3();
  const previews = Array.from(
    { length: START_PARTICLE_SETTINGS.previewCount },
    () => ({
      goalPosition: new Vector3(),
      goalNormal: new Vector3(),
      goalUp: new Vector3(),
      ringRadiusMeters: 0,
      crossingAgeSeconds: undefined as number | undefined,
    }),
  );
  const goalPosition = new Vector3();
  const goalNormal = new Vector3();
  const targetOffset = new Vector3();
  let ringRadiusMeters = parameters.course.radiusMeters[0];

  return {
    arrowLengthMeters,
    goalPosition,
    goalNormal,
    goalUp,
    arrowPosition,
    arrowNormal,
    arrowUp,
    approachDirection,
    turnDirection,
    previews,
    get ringRadiusMeters() {
      return ringRadiusMeters;
    },
    placeArrow,
    placeGoal,
  };

  /** Capture the cue and its promised tunnel entrance once, in world coordinates. */
  function placeArrow(direction: StartDirection, goalIndex: number): void {
    origin.copy(viewpoint.worldPosition);

    approachDirection.copy(motion.direction);
    const horizontal = direction === "right" || direction === "left";
    turnDirection.copy(
      horizontal
        ? turnDirection
            .crossVectors(
              viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
              WORLD_UP,
            )
            .normalize()
        : WORLD_UP,
    );
    if (direction === "left" || direction === "down") turnDirection.negate();
    // Enough lead distance to lean and turn before reaching the cue's plane.
    const distance = Math.max(
      START_SETTINGS.minimumArrowLeadMeters,
      sample(
        goalIndex === 0
          ? parameters.course.firstDistanceMeters
          : parameters.course.spacingMeters,
      ),
      arrowLengthMeters /
        Math.tan(Math.max(0.1, viewpoint.viewHalfAngleRadians)),
    );
    motion.predictPosition(origin, distance, arrowPosition, predictedTangent);
    // Retain the flight-relative axis into the upcoming turn. The broad face
    // is oriented toward the captured eye after placing this fixed anchor.
    arrowDirection
      .copy(turnDirection)
      .addScaledVector(predictedTangent, -turnDirection.dot(predictedTangent));
    if (arrowDirection.lengthSq() < START_SETTINGS.minimumTravelSquared)
      arrowDirection.copy(turnDirection);
    arrowDirection
      .normalize()
      .multiplyScalar(START_SETTINGS.arrowTurnComponent)
      .addScaledVector(predictedTangent, START_SETTINGS.arrowForwardComponent)
      .normalize();
    tunnelEntry
      .copy(arrowPosition)
      .addScaledVector(
        arrowDirection,
        arrowLengthMeters / 2 + START_SETTINGS.arrowTunnelClearanceMeters,
      );
    targetOffset.copy(arrowPosition).sub(origin);
    const predictionAngle = targetOffset.angleTo(viewpoint.worldDirection);
    const visibleAngle = Math.max(
      0,
      viewpoint.viewHalfAngleRadians * 0.5 -
        Math.atan((arrowLengthMeters * 0.5) / distance),
    );
    // Move cue and entrance together, preserving the spoken turn direction.
    // A small shared offset accommodates gaze without making a level turn
    // require climbing, or turning a downward instruction into an upward one.
    if (predictionAngle > visibleAngle) {
      targetOffset
        .normalize()
        .lerp(viewpoint.worldDirection, 1 - visibleAngle / predictionAngle)
        .normalize()
        .multiplyScalar(distance)
        .add(origin)
        .sub(arrowPosition);
      const maximumOffset = parameters.course.radiusMeters[0] * 0.5;
      if (targetOffset.length() > maximumOffset)
        targetOffset.setLength(maximumOffset);
      arrowPosition.add(targetOffset);
      tunnelEntry.add(targetOffset);
    }
    // Roll the broad arrow face toward the captured eye, retaining its axis
    // into the reserved opening. World-up makes vertical cues edge-on.
    arrowNormal.copy(origin).sub(arrowPosition).projectOnPlane(arrowDirection);
    if (arrowNormal.lengthSq() < START_SETTINGS.minimumTravelSquared)
      arrowNormal.copy(viewpoint.worldUp).projectOnPlane(arrowDirection);
    if (arrowNormal.lengthSq() < START_SETTINGS.minimumTravelSquared)
      arrowNormal.set(1, 0, 0).projectOnPlane(arrowDirection);
    arrowNormal.normalize();
    arrowUp.crossVectors(arrowNormal, arrowDirection).normalize();
    // Both anchors are now frozen; head motion cannot change their promise.
    goalPosition.copy(tunnelEntry);
  }

  /** Publish rings only when the fixed entrance is visible and the sampled path is flyable. */
  function placeGoal(): boolean {
    origin.copy(viewpoint.worldPosition);
    const radius = sample(parameters.course.radiusMeters);
    const distance = origin.distanceTo(tunnelEntry);
    targetOffset.copy(tunnelEntry).sub(origin);
    const depth = targetOffset.dot(viewpoint.worldDirection);
    const lateral = Math.sqrt(
      Math.max(0, targetOffset.lengthSq() - depth * depth),
    );
    if (
      depth <= 0 ||
      lateral > depth * Math.tan(viewpoint.viewHalfAngleRadians)
    )
      return false;

    // The first opening is the promise made by the fixed arrow. Only the unseen
    // approach adapts to current travel, joining that opening without a corner.
    approachCurve.v0.copy(origin);
    approachCurve.v1
      .copy(origin)
      .addScaledVector(motion.direction, distance / 3);
    approachCurve.v2
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, -distance / 3);
    approachCurve.v3.copy(tunnelEntry);
    const tunnelSpan =
      previews.length *
      Math.max(START_SETTINGS.minimumRingSpacingMeters, radius * 0.5);
    lessonBend
      .copy(turnDirection)
      .addScaledVector(arrowDirection, -turnDirection.dot(arrowDirection))
      .multiplyScalar(START_SETTINGS.lessonBendComponent);
    lessonBend.addScaledVector(
      motion.curvature,
      Math.min(tunnelSpan, START_SETTINGS.curvatureDecayMeters) * 0.25,
    );
    tunnelCurve.v0.copy(tunnelEntry);
    tunnelCurve.v1
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, tunnelSpan / 3);
    tunnelCurve.v2
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, (tunnelSpan * 2) / 3)
      .addScaledVector(lessonBend, tunnelSpan / 3);
    tunnelCurve.v3
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, tunnelSpan)
      .addScaledVector(lessonBend, tunnelSpan);
    if (!buildCourse()) return false;
    const finalSample = courseSamples[START_SETTINGS.courseSampleCount];
    const entrySample = courseSamples[START_SETTINGS.courseEntrySample];
    if (!finalSample || !entrySample) return false;
    goalPosition.copy(finalSample.position);
    goalNormal.copy(finalSample.tangent).negate();
    goalUp.copy(finalSample.up);
    ringRadiusMeters = radius;
    for (const [index, preview] of previews.entries()) {
      preview.crossingAgeSeconds = undefined;
      sampleCourseAtLength(
        entrySample.distance +
          ((finalSample.distance - entrySample.distance) * index) /
            previews.length,
        preview.goalPosition,
        preview.goalNormal,
        preview.goalUp,
      );
      preview.goalNormal.negate();
      preview.ringRadiusMeters = radius;
    }
    return true;
  }

  /** A fixed table serves both reachable-path checks and arc-length placement. */
  function buildCourse(): boolean {
    const speed = Math.max(motion.speed, 0.5);
    for (const [index, sample] of courseSamples.entries()) {
      const approaching = index <= START_SETTINGS.courseEntrySample;
      const curve = approaching ? approachCurve : tunnelCurve;
      const t = approaching
        ? index / START_SETTINGS.courseEntrySample
        : (index - START_SETTINGS.courseEntrySample) /
          (START_SETTINGS.courseSampleCount - START_SETTINGS.courseEntrySample);
      curve.getPoint(t, sample.position);
      // Analytic derivative avoids Curve.getTangent's temporary vectors.
      sample.tangent
        .copy(curve.v1)
        .sub(curve.v0)
        .multiplyScalar((1 - t) ** 2)
        .addScaledVector(
          targetOffset.copy(curve.v2).sub(curve.v1),
          2 * (1 - t) * t,
        )
        .addScaledVector(targetOffset.copy(curve.v3).sub(curve.v2), t * t)
        .normalize();
      if (
        maximumGoalYAt &&
        sample.position.y > maximumGoalYAt(sample.position.x, sample.position.z)
      )
        return false;
      const previous = courseSamples[index - 1];
      if (!previous) {
        sample.distance = 0;
        sample.up
          .copy(viewpoint.worldUp)
          .addScaledVector(
            sample.tangent,
            -viewpoint.worldUp.dot(sample.tangent),
          );
        if (sample.up.lengthSq() < START_SETTINGS.minimumTravelSquared)
          sample.up.set(1, 0, 0);
        sample.up.normalize();
        continue;
      }
      const segmentLength = sample.position.distanceTo(previous.position);
      sample.distance = previous.distance + segmentLength;
      const stepSeconds = segmentLength / speed;
      const verticalSpeed =
        (sample.position.y - previous.position.y) / stepSeconds;
      if (
        verticalSpeed >
          FLIGHT_SETTINGS.climbRateMetersPerSecond -
            FLIGHT_SETTINGS.neutralDescentMetersPerSecond ||
        verticalSpeed <
          -FLIGHT_SETTINGS.climbRateMetersPerSecond -
            FLIGHT_SETTINGS.neutralDescentMetersPerSecond
      )
        return false;
      const horizontalTurn = Math.atan2(
        previous.tangent.x * sample.tangent.z -
          previous.tangent.z * sample.tangent.x,
        previous.tangent.x * sample.tangent.x +
          previous.tangent.z * sample.tangent.z,
      );
      if (
        Math.abs(horizontalTurn) >
        FLIGHT_SETTINGS.yawRateRadiansPerSecond * stepSeconds
      )
        return false;
      transportRotation.setFromUnitVectors(previous.tangent, sample.tangent);
      sample.up
        .copy(previous.up)
        .applyQuaternion(transportRotation)
        .normalize();
    }
    return true;
  }

  function sampleCourseAtLength(
    distance: number,
    position: Vector3,
    tangent: Vector3,
    up: Vector3,
  ): void {
    for (const [index, sample] of courseSamples.entries()) {
      const previous = courseSamples[index - 1];
      if (!previous || sample.distance < distance) continue;
      const span = sample.distance - previous.distance;
      const fraction = span > 0 ? (distance - previous.distance) / span : 0;
      position.lerpVectors(previous.position, sample.position, fraction);
      tangent
        .lerpVectors(previous.tangent, sample.tangent, fraction)
        .normalize();
      up.lerpVectors(previous.up, sample.up, fraction);
      up.addScaledVector(tangent, -up.dot(tangent)).normalize();
      return;
    }
  }

  function sample([minimum, maximum]: DistanceRange): number {
    return minimum + (maximum - minimum) * random();
  }
}
