import { CubicBezierCurve3, Quaternion, Vector3 } from "three";
import { FLIGHT_SETTINGS } from "../../control/flight-settings";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-goals";
import type {
  StartParticleEffect,
  StartParticleObjects,
  StartParticleParameters,
} from "./start-particles.effect";

export type StartDirection = "right" | "left" | "up" | "down";

const WORLD_UP = new Vector3(0, 1, 0);
const TURN_COMPONENT = 0.12;
const TURN_CONFIRM_SECONDS = 0.2;
const ARROW_OUT_OF_VIEW_SECONDS = 2;
const ARROW_FADE_SECONDS = 3;
const ARROW_FORWARD_COMPONENT = 0.8;
const ARROW_TURN_COMPONENT = 0.6;
const ARROW_TUNNEL_CLEARANCE_METERS = 0.75;
const MINIMUM_ARROW_LEAD_METERS = 8;
const MINIMUM_RING_SPACING_METERS = 1;
const MINIMUM_TRAVEL_SQUARED = 0.000001;
const MOTION_HISTORY_SECONDS = 0.25;
const MAXIMUM_CURVATURE_PER_METER = 0.12;
const CURVATURE_DECAY_METERS = 4;
const MAXIMUM_OBSERVED_SPEED_METERS_PER_SECOND = 12;
const COURSE_SAMPLE_COUNT = 32;
const COURSE_ENTRY_SAMPLE = 24;
const MAXIMUM_PREDICTION_SECONDS = 6;
const LESSON_BEND_COMPONENT = 0.12;
const FORECAST_SPREAD_PER_METER = 0.04;

type DistanceRange = readonly [minimum: number, maximum: number];

export interface StartParameters {
  /** Relative level of the existing organ wind during practice, 0..1. */
  readonly windStrength?: number;
  /** Show limits integrated practice; standalone Start remains an independent test. */
  readonly maximumPracticeSeconds: number;
  readonly directions: readonly [StartDirection, ...StartDirection[]];
  /** Sampled per course section in the current view; live goals stay world-fixed. */
  readonly course: {
    readonly firstDistanceMeters: DistanceRange;
    readonly spacingMeters: DistanceRange;
    readonly radiusMeters: DistanceRange;
  };
  readonly arrivalSeconds: number;
  readonly formationSeconds: number;
  readonly dissolutionSeconds: number;
  /** Omission creates no particle resources or presentation work. */
  readonly particles?: StartParticleParameters;
}

export type StartPhase =
  | "arrival"
  | "turning"
  | "forming"
  | "flying"
  | "crossed"
  | "missed"
  | "complete";

/** Borrowed until the next World frame; consumers must not retain or mutate it. */
export interface StartObservation {
  readonly phase: StartPhase;
  readonly goalIndex: number;
  readonly direction: StartDirection;
  readonly goalPosition: Readonly<Vector3>;
  /** Steering hint during the arrow cue; fixed passage target once the tunnel forms. */
  readonly goalTarget: Readonly<Vector3>;
  readonly formationProgress: number;
  readonly arrowFormationProgress: number;
  readonly crossingCount: number;
  /** All first ring passages, including uncounted guidance previews. */
  readonly passageCount: number;
  /** Borrowed fixed world center of the most recent passed ring. */
  readonly passagePosition: Readonly<Vector3>;
  readonly attempt: number;
  readonly missCount: number;
  /** Bounded observation-based horizon and heuristic spread, not collision guarantees. */
  readonly predictionSeconds?: number;
  readonly predictionSpreadMeters?: number;
  readonly objects?: StartParticleObjects;
  readonly wake:
    | {
        readonly position: Readonly<Vector3>;
        readonly direction: Readonly<Vector3>;
        readonly strength: number;
        readonly ageSeconds: number;
      }
    | undefined;
}

export interface StartModuleHandle {
  readonly module: WorldModule;
  readonly readObservation: () => StartObservation;
  /** Pause freezes learning and presentation; Run owns freezing locomotion. */
  readonly setPlaying: (playing: boolean) => void;
  /** Show may let the current spoken instruction finish before the next goal. */
  readonly setGoalAdvanceAllowed: (allowed: boolean) => void;
  /** Show opens formation at the spoken instruction, independently of cue completion. */
  readonly setFormationAllowed: (allowed: boolean) => void;
  /** Forget the old movement segment when Run resets its flight pose. */
  readonly reset: () => void;
}

interface StartModuleOptions {
  /** Optional reproducible sampling; only goal creation consumes randomness. */
  readonly random?: () => number;
  readonly viewpoint: Viewpoint;
  readonly parameters: StartParameters;
  /** Borrow the same ceiling used by Run; generation never changes flight limits. */
  readonly maximumGoalYAt?: (x: number, z: number) => number;
  /** Composition selects presentation; this module owns its complete lifetime. */
  readonly particles?: StartParticleEffect;
}

/** Spatial learning inside World's existing lifetime and frame loop. */
export function createStartModule(
  options: StartModuleOptions,
): StartModuleHandle {
  const { parameters, particles, viewpoint } = options;
  const random = options.random ?? Math.random;
  const positive = [
    parameters.arrivalSeconds,
    parameters.formationSeconds,
    parameters.dissolutionSeconds,
  ];
  if (
    positive.some((number) => !Number.isFinite(number) || number <= 0) ||
    !parameters.directions.length ||
    Object.values(parameters.course).some(
      ([minimum, maximum]) =>
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum <= 0 ||
        maximum < minimum,
    )
  )
    throw new Error("Start needs positive timings and ordered distance ranges");

  const origin = new Vector3();
  const previousTravelDirection = new Vector3();
  const curvature = new Vector3();
  const sampledCurvature = new Vector3();
  const predictedTangent = new Vector3();
  const tunnelEntry = new Vector3();
  const approachCurve = new CubicBezierCurve3();
  const tunnelCurve = new CubicBezierCurve3();
  let hasMotionHistory = false;
  const goalUp = new Vector3();
  const previousPosition = new Vector3();
  const previousFlightPosition = new Vector3();
  const flightTravel = new Vector3();
  let observedSpeed = 0;
  let directionVariation = 0;
  const lessonBend = new Vector3();
  const transportRotation = new Quaternion();
  const courseSamples = Array.from({ length: COURSE_SAMPLE_COUNT + 1 }, () => ({
    position: new Vector3(),
    tangent: new Vector3(),
    up: new Vector3(),
    distance: 0,
  }));
  const retiringArrow = {
    position: new Vector3(),
    normal: new Vector3(),
    up: new Vector3(),
    angleRadians: 0,
    formation: 0,
    presence: 0,
  };
  const arrowLifetime = {
    outsideSeconds: 0,
    fadeSeconds: -1,
    releaseFormation: 0,
  };
  const retiringLifetime = {
    outsideSeconds: 0,
    fadeSeconds: -1,
    releaseFormation: 0,
  };
  const arrowPosition = new Vector3();
  const arrowNormal = new Vector3();
  const arrowDirection = new Vector3();
  const arrowUp = new Vector3();
  const approachDirection = new Vector3();
  const turnDirection = new Vector3();
  const currentTravelDirection = new Vector3();
  const previews = Array.from({ length: 3 }, () => ({
    goalPosition: new Vector3(),
    goalNormal: new Vector3(),
    goalUp: new Vector3(),
    ringRadiusMeters: 0,
    crossingAgeSeconds: undefined as number | undefined,
  }));
  const targetPosition = new Vector3();
  const goalPosition = new Vector3();
  const goalNormal = new Vector3();
  const passagePosition = new Vector3();
  const wakePosition = new Vector3();
  const wakeDirection = new Vector3();
  const wake = {
    position: wakePosition,
    direction: wakeDirection,
    strength: 1,
    ageSeconds: 0,
  };
  const observation = {
    phase: "arrival" as StartPhase,
    goalIndex: 0,
    direction: parameters.directions[0],
    goalPosition,
    goalTarget: targetPosition,
    formationProgress: 0,
    arrowFormationProgress: 0,
    crossingCount: 0,
    passageCount: 0,
    passagePosition,
    attempt: 0,
    missCount: 0,
    predictionSeconds: 0,
    predictionSpreadMeters: 0,
    objects: undefined as StartParticleObjects | undefined,
    wake: undefined as StartObservation["wake"],
  };
  const particleFrame = {
    elapsedSeconds: 0,
    goalPosition,
    arrowPosition,
    arrowNormal,
    arrowUp,
    arrowPresence: 0,
    arrowFormation: 0,
    retiringArrow,
    ringPresence: 0,
    goalNormal,
    goalUp,
    ringRadiusMeters: parameters.course.radiusMeters[0],
    arrowAngleRadians: 0,
    formationProgress: 0,
    previews: [] as typeof previews,
    previewElapsedSeconds: 0,
    sectionPresence: 1,
    wake: undefined as StartObservation["wake"],
  };
  let loaded = false;
  let active = false;
  let playing = true;
  let initialized = false;
  let phaseSeconds = 0;
  let dissolutionFormation = 1;
  let previewStartedSeconds = 0;
  let goalAdvanceAllowed = true;
  let formationAllowed = true;
  let turnSeconds = 0;
  const travel = new Vector3();
  const targetOffset = new Vector3();

  return {
    readObservation: () => observation,
    setPlaying: (next) => {
      if (playing !== next) resetMotionHistory();
      playing = next;
    },
    setFormationAllowed: (allowed) => {
      formationAllowed = allowed;
    },
    setGoalAdvanceAllowed: (allowed) => {
      goalAdvanceAllowed = allowed;
    },
    reset,
    module: {
      load: () => {
        reset();
        particles?.load();
        loaded = true;
      },
      activate: () => {
        active = true;
        resetMotionHistory();
        particles?.setVisible(true);
      },
      update,
      deactivate: () => {
        active = false;
        particles?.setVisible(false);
        observation.objects = undefined;
      },
      unload: () => {
        active = false;
        loaded = false;
        particles?.unload();
        observation.objects = undefined;
      },
    },
  };

  function reset(): void {
    initialized = false;
    resetMotionHistory();
    goalAdvanceAllowed = true;
    formationAllowed = true;
    phaseSeconds = 0;
    particleFrame.elapsedSeconds = 0;
    previewStartedSeconds = 0;
    observation.phase = "arrival";
    observation.goalIndex = 0;
    observation.direction = parameters.directions[0];
    observation.formationProgress = 0;
    observation.arrowFormationProgress = 0;
    observation.crossingCount = 0;
    observation.passageCount = 0;
    passagePosition.set(0, 0, 0);
    observation.attempt = 0;
    observation.missCount = 0;
    observation.predictionSeconds = 0;
    observation.predictionSpreadMeters = 0;
    particleFrame.sectionPresence = 0;
    particleFrame.arrowPresence = 0;
    particleFrame.arrowFormation = 0;
    particleFrame.ringPresence = 0;
    particleFrame.previews = [];
    turnSeconds = 0;
    arrowLifetime.outsideSeconds = 0;
    arrowLifetime.fadeSeconds = -1;
    observation.wake = undefined;
    observation.objects = undefined;
    retiringArrow.presence = 0;
    retiringLifetime.outsideSeconds = 0;
    retiringLifetime.fadeSeconds = -1;
  }

  function resetMotionHistory(): void {
    previousPosition.copy(viewpoint.worldPosition);
    previousFlightPosition.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
    observedSpeed = 0;
    directionVariation = 0;
    hasMotionHistory = false;
    curvature.set(0, 0, 0);
    currentTravelDirection.copy(
      viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
    );
  }

  function observeMotion(elapsed: number): void {
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
    if (options.maximumGoalYAt) {
      const ceiling = options.maximumGoalYAt(position.x, position.z);
      if (position.y > ceiling) {
        position.y = ceiling;
        tangent.y = 0;
      }
    }
    tangent.normalize();
  }

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
      .addScaledVector(currentTravelDirection, distance / 3);
    approachCurve.v2
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, -distance / 3);
    approachCurve.v3.copy(tunnelEntry);
    const tunnelSpan =
      previews.length * Math.max(MINIMUM_RING_SPACING_METERS, radius * 0.5);
    lessonBend
      .copy(turnDirection)
      .addScaledVector(arrowDirection, -turnDirection.dot(arrowDirection))
      .multiplyScalar(LESSON_BEND_COMPONENT);
    lessonBend.addScaledVector(
      curvature,
      Math.min(tunnelSpan, CURVATURE_DECAY_METERS) * 0.25,
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
    const finalSample = courseSamples[COURSE_SAMPLE_COUNT];
    const entrySample = courseSamples[COURSE_ENTRY_SAMPLE];
    if (!finalSample || !entrySample) return false;
    targetPosition.copy(finalSample.position);
    goalPosition.copy(targetPosition);
    goalNormal.copy(finalSample.tangent).negate();
    goalUp.copy(finalSample.up);
    observation.predictionSeconds = Math.min(
      MAXIMUM_PREDICTION_SECONDS,
      finalSample.distance / Math.max(observedSpeed, 0.5),
    );
    observation.predictionSpreadMeters =
      finalSample.distance * (FORECAST_SPREAD_PER_METER + directionVariation);
    particleFrame.ringRadiusMeters = radius;
    particleFrame.previews = previews;
    previewStartedSeconds = particleFrame.elapsedSeconds;
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
    const speed = Math.max(observedSpeed, 0.5);
    for (const [index, sample] of courseSamples.entries()) {
      const approaching = index <= COURSE_ENTRY_SAMPLE;
      const curve = approaching ? approachCurve : tunnelCurve;
      const t = approaching
        ? index / COURSE_ENTRY_SAMPLE
        : (index - COURSE_ENTRY_SAMPLE) /
          (COURSE_SAMPLE_COUNT - COURSE_ENTRY_SAMPLE);
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
        options.maximumGoalYAt &&
        sample.position.y >
          options.maximumGoalYAt(sample.position.x, sample.position.z)
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
        if (sample.up.lengthSq() < MINIMUM_TRAVEL_SQUARED)
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

  function placeArrow(): void {
    if (particleFrame.arrowPresence > 0) {
      retiringArrow.position.copy(arrowPosition);
      retiringArrow.normal.copy(arrowNormal);
      retiringArrow.up.copy(arrowUp);
      retiringArrow.angleRadians = particleFrame.arrowAngleRadians;
      retiringArrow.formation = particleFrame.arrowFormation;
      retiringArrow.presence = particleFrame.arrowPresence;
      retiringLifetime.outsideSeconds = arrowLifetime.outsideSeconds;
      retiringLifetime.fadeSeconds = arrowLifetime.fadeSeconds;
      retiringLifetime.releaseFormation =
        arrowLifetime.fadeSeconds >= 0
          ? arrowLifetime.releaseFormation
          : particleFrame.arrowFormation;
    }
    origin.copy(viewpoint.worldPosition);

    approachDirection.copy(currentTravelDirection);
    const direction = observation.direction;
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
      MINIMUM_ARROW_LEAD_METERS,
      sample(
        observation.goalIndex === 0
          ? parameters.course.firstDistanceMeters
          : parameters.course.spacingMeters,
      ),
      (parameters.particles?.arrowLengthMeters ?? 6) /
        Math.tan(Math.max(0.1, viewpoint.viewHalfAngleRadians)),
    );
    predictPosition(distance, arrowPosition, predictedTangent);
    // Retain the flight-relative axis into the upcoming turn. The broad face
    // is oriented toward the captured eye after placing this fixed anchor.
    arrowDirection
      .copy(turnDirection)
      .addScaledVector(predictedTangent, -turnDirection.dot(predictedTangent));
    if (arrowDirection.lengthSq() < MINIMUM_TRAVEL_SQUARED)
      arrowDirection.copy(turnDirection);
    arrowDirection
      .normalize()
      .multiplyScalar(ARROW_TURN_COMPONENT)
      .addScaledVector(predictedTangent, ARROW_FORWARD_COMPONENT)
      .normalize();
    tunnelEntry
      .copy(arrowPosition)
      .addScaledVector(
        arrowDirection,
        (parameters.particles?.arrowLengthMeters ?? 6) / 2 +
          ARROW_TUNNEL_CLEARANCE_METERS,
      );
    targetOffset.copy(arrowPosition).sub(origin);
    const predictionAngle = targetOffset.angleTo(viewpoint.worldDirection);
    const visibleAngle = Math.max(
      0,
      viewpoint.viewHalfAngleRadians * 0.5 -
        Math.atan(
          ((parameters.particles?.arrowLengthMeters ?? 6) * 0.5) / distance,
        ),
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
    if (arrowNormal.lengthSq() < MINIMUM_TRAVEL_SQUARED)
      arrowNormal.copy(viewpoint.worldUp).projectOnPlane(arrowDirection);
    if (arrowNormal.lengthSq() < MINIMUM_TRAVEL_SQUARED)
      arrowNormal.set(1, 0, 0).projectOnPlane(arrowDirection);
    arrowNormal.normalize();
    arrowUp.crossVectors(arrowNormal, arrowDirection).normalize();
    // Both anchors are now frozen; head motion cannot change their promise.
    targetPosition.copy(tunnelEntry);
    goalPosition.copy(targetPosition);
    particleFrame.arrowAngleRadians = 0;
    particleFrame.arrowPresence = 1;
    particleFrame.arrowFormation = 0;
    particleFrame.ringPresence = 0;
    particleFrame.previews = [];
    particleFrame.sectionPresence = 1;
    turnSeconds = 0;
    arrowLifetime.outsideSeconds = 0;
    arrowLifetime.fadeSeconds = -1;
  }

  function miss(): void {
    observation.phase = "missed";
    dissolutionFormation = observation.formationProgress;
    observation.missCount += 1;
    observation.wake = undefined;
    phaseSeconds = 0;
  }

  function updateArrowLifetime(
    position: Vector3,
    lifetime: typeof arrowLifetime,
    elapsed: number,
    retiring: boolean,
  ): void {
    const presence = retiring
      ? retiringArrow.presence
      : particleFrame.arrowPresence;
    if (
      elapsed <= 0 ||
      presence <= 0 ||
      (!retiring && observation.phase === "turning" && phaseSeconds === 0)
    )
      return;
    targetOffset.copy(position).sub(viewpoint.worldPosition);
    if (lifetime.fadeSeconds < 0) {
      const inView =
        targetOffset.angleTo(viewpoint.worldDirection) <
        viewpoint.viewHalfAngleRadians +
          Math.atan2(
            (parameters.particles?.arrowLengthMeters ?? 6) / 2,
            targetOffset.length(),
          );
      lifetime.outsideSeconds = inView ? 0 : lifetime.outsideSeconds + elapsed;
      if (lifetime.outsideSeconds < ARROW_OUT_OF_VIEW_SECONDS) return;
      lifetime.fadeSeconds = 0;
      lifetime.releaseFormation = retiring
        ? retiringArrow.formation
        : particleFrame.arrowFormation;
    } else lifetime.fadeSeconds += elapsed;
    const remaining = Math.max(
      0,
      1 - lifetime.fadeSeconds / ARROW_FADE_SECONDS,
    );
    if (retiring) {
      retiringArrow.presence = remaining;
      retiringArrow.formation = lifetime.releaseFormation * remaining;
    } else {
      particleFrame.arrowPresence = remaining;
      particleFrame.arrowFormation = lifetime.releaseFormation * remaining;
    }
  }

  function sample([minimum, maximum]: DistanceRange): number {
    return minimum + (maximum - minimum) * random();
  }

  function update(deltaSeconds: number): void {
    if (!loaded || !active) return;
    if (!initialized) {
      previousPosition.copy(viewpoint.worldPosition);
      previousFlightPosition.copy(
        viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
      );
      initialized = true;
    }
    const elapsed =
      playing && Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    particleFrame.elapsedSeconds += elapsed;
    phaseSeconds += elapsed;
    if (observation.wake) wake.ageSeconds += elapsed;
    travel.copy(viewpoint.worldPosition).sub(previousPosition);
    flightTravel
      .copy(viewpoint.worldFlightPosition ?? viewpoint.worldPosition)
      .sub(previousFlightPosition);
    observeMotion(elapsed);
    for (const preview of previews) {
      if (preview.crossingAgeSeconds !== undefined)
        preview.crossingAgeSeconds += elapsed;
      else if (
        playing &&
        observation.phase === "flying" &&
        crossesFlightRing(
          previousPosition,
          viewpoint.worldPosition,
          preview.goalPosition,
          preview.goalNormal,
          preview.ringRadiusMeters,
        )
      ) {
        preview.crossingAgeSeconds = 0;
        observation.passageCount += 1;
        passagePosition.copy(preview.goalPosition);
      }
    }

    if (observation.phase === "arrival") {
      const progress = Math.min(1, phaseSeconds / parameters.arrivalSeconds);
      if (playing && progress === 1 && formationAllowed) {
        placeArrow();
        observation.phase = "turning";
        phaseSeconds = 0;
      }
    } else if (observation.phase === "turning") {
      particleFrame.arrowFormation = Math.min(
        1,
        phaseSeconds / parameters.formationSeconds,
      );
      if (
        playing &&
        particleFrame.arrowFormation === 1 &&
        flightTravel.lengthSq() > MINIMUM_TRAVEL_SQUARED
      ) {
        const turn =
          currentTravelDirection.dot(turnDirection) -
          approachDirection.dot(turnDirection);
        turnSeconds = turn >= TURN_COMPONENT ? turnSeconds + elapsed : 0;
        if (turnSeconds >= TURN_CONFIRM_SECONDS && placeGoal()) {
          particleFrame.ringPresence = 1;
          observation.phase = "forming";
          phaseSeconds = 0;
        }
      }
    } else if (observation.phase === "forming") {
      observation.formationProgress = Math.min(
        1,
        phaseSeconds / parameters.formationSeconds,
      );
      if (observation.formationProgress === 1) {
        observation.phase = "flying";
        phaseSeconds = 0;
      }
    } else if (
      observation.phase === "flying" &&
      playing &&
      crossesFlightRing(
        previousPosition,
        viewpoint.worldPosition,
        targetPosition,
        goalNormal,
        particleFrame.ringRadiusMeters,
      )
    ) {
      observation.crossingCount += 1;
      observation.passageCount += 1;
      passagePosition.copy(targetPosition);
      const before =
        (previousPosition.x - targetPosition.x) * goalNormal.x +
        (previousPosition.y - targetPosition.y) * goalNormal.y +
        (previousPosition.z - targetPosition.z) * goalNormal.z;
      const after =
        (viewpoint.worldPosition.x - targetPosition.x) * goalNormal.x +
        (viewpoint.worldPosition.y - targetPosition.y) * goalNormal.y +
        (viewpoint.worldPosition.z - targetPosition.z) * goalNormal.z;
      wakePosition.lerpVectors(
        previousPosition,
        viewpoint.worldPosition,
        before / (before - after),
      );
      wakeDirection
        .copy(viewpoint.worldPosition)
        .sub(previousPosition)
        .normalize();
      wake.ageSeconds = 0;
      observation.wake = wake;
      observation.phase = "crossed";
      dissolutionFormation = 1;
      phaseSeconds = 0;
    } else if (
      observation.phase === "crossed" ||
      observation.phase === "missed"
    ) {
      observation.formationProgress =
        dissolutionFormation *
        (1 - Math.min(1, phaseSeconds / parameters.dissolutionSeconds));
      if (observation.phase === "missed")
        particleFrame.sectionPresence =
          1 - Math.min(1, phaseSeconds / parameters.dissolutionSeconds);
      if (
        phaseSeconds >= parameters.dissolutionSeconds &&
        (observation.phase === "missed" || goalAdvanceAllowed)
      ) {
        if (observation.phase === "missed") {
          observation.attempt += 1;
          observation.phase = "arrival";
          particleFrame.sectionPresence = 0;
        } else if (observation.goalIndex + 1 === parameters.directions.length) {
          observation.phase = "complete";
          particleFrame.previews = [];
        } else {
          observation.goalIndex += 1;
          observation.phase = "arrival";
          particleFrame.sectionPresence = 0;
          observation.direction =
            parameters.directions[observation.goalIndex] ??
            observation.direction;
          observation.wake = undefined;
        }
        if (
          observation.phase === "arrival" ||
          observation.phase === "complete"
        ) {
          particleFrame.ringPresence = 0;
        }
        phaseSeconds = 0;
      }
    }
    updateArrowLifetime(arrowPosition, arrowLifetime, elapsed, false);
    updateArrowLifetime(
      retiringArrow.position,
      retiringLifetime,
      elapsed,
      true,
    );
    if (observation.phase === "turning" && arrowLifetime.fadeSeconds >= 0)
      miss();
    if (observation.phase === "missed")
      particleFrame.ringPresence = particleFrame.previews.length
        ? particleFrame.sectionPresence
        : 0;
    // Retire only through spatial movement, never because a lesson timed out.
    // The same fixed goal/preview slots are recycled after their short fade.
    travel.copy(viewpoint.worldPosition).sub(previousPosition);
    targetOffset.copy(viewpoint.worldPosition).sub(targetPosition);
    if (
      playing &&
      (observation.phase === "flying" || observation.phase === "forming") &&
      travel.lengthSq() > 0 &&
      (targetOffset.dot(goalNormal) < -particleFrame.ringRadiusMeters ||
        (targetOffset.lengthSq() > viewpoint.viewDistanceMeters ** 2 &&
          targetOffset.dot(travel) > 0))
    ) {
      miss();
    }
    previousPosition.copy(viewpoint.worldPosition);
    previousFlightPosition.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
    observation.arrowFormationProgress =
      particleFrame.arrowFormation * particleFrame.arrowPresence;
    if (!particles) return;
    particleFrame.previewElapsedSeconds =
      particleFrame.elapsedSeconds - previewStartedSeconds;
    particleFrame.formationProgress = observation.formationProgress;
    particleFrame.wake = observation.wake;
    particles?.update(particleFrame);
    observation.objects = particles.readObjectAnchors();
  }
}
