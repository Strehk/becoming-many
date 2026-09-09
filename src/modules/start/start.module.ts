import { Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-goals";
import type {
  StartParticleEffect,
  StartParticleObjects,
  StartParticleParameters,
} from "./start-particles.effect";

export type StartDirection = "right" | "left" | "up" | "down";

const TURN_COMPONENT = 0.12;
const TURN_CONFIRM_SECONDS = 0.2;
const ARROW_OUT_OF_VIEW_SECONDS = 0.8;
const ARROW_FADE_SECONDS = 1;
const MINIMUM_TRAVEL_SQUARED = 0.000001;
const MOTION_HISTORY_SECONDS = 0.25;
const MAXIMUM_CURVATURE_PER_METER = 0.12;
const CURVATURE_DECAY_METERS = 4;
const MAXIMUM_OBSERVED_SPEED_METERS_PER_SECOND = 12;

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
  readonly attempt: number;
  readonly missCount: number;
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
  const corridorCorrection = new Vector3();
  const predictedOffset = new Vector3();
  let hasMotionHistory = false;
  const goalUp = new Vector3();
  const previousPosition = new Vector3();
  const arrowPosition = new Vector3();
  const arrowNormal = new Vector3();
  const arrowUp = new Vector3();
  const approachDirection = new Vector3();
  const turnDirection = new Vector3();
  const currentTravelDirection = new Vector3();
  const previews = Array.from({ length: 3 }, () => ({
    goalPosition: new Vector3(),
    goalNormal: new Vector3(),
    ringRadiusMeters: 0,
    crossingAgeSeconds: undefined as number | undefined,
  }));
  const targetPosition = new Vector3();
  const goalPosition = new Vector3();
  const goalNormal = new Vector3();
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
    attempt: 0,
    missCount: 0,
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
  let arrowOutsideSeconds = 0;
  let arrowDissolutionFormation = 0;
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
    observation.attempt = 0;
    observation.missCount = 0;
    particleFrame.sectionPresence = 0;
    particleFrame.arrowPresence = 0;
    particleFrame.arrowFormation = 0;
    particleFrame.ringPresence = 0;
    particleFrame.previews = [];
    turnSeconds = 0;
    arrowOutsideSeconds = 0;
    observation.wake = undefined;
    observation.objects = undefined;
  }

  function resetMotionHistory(): void {
    previousPosition.copy(viewpoint.worldPosition);
    hasMotionHistory = false;
    curvature.set(0, 0, 0);
    currentTravelDirection.copy(viewpoint.worldDirection);
  }

  function observeMotion(elapsed: number): void {
    if (elapsed <= 0) return;
    if (
      travel.lengthSq() <= MINIMUM_TRAVEL_SQUARED ||
      travel.length() / elapsed > MAXIMUM_OBSERVED_SPEED_METERS_PER_SECOND
    ) {
      hasMotionHistory = false;
      curvature.set(0, 0, 0);
      currentTravelDirection.copy(viewpoint.worldDirection);
      return;
    }
    currentTravelDirection.copy(travel).normalize();
    if (hasMotionHistory && elapsed <= MOTION_HISTORY_SECONDS) {
      sampledCurvature
        .copy(currentTravelDirection)
        .sub(previousTravelDirection)
        .multiplyScalar(1 / travel.length());
      // Only sideways change bends the prediction; speed remains Run-owned.
      sampledCurvature.addScaledVector(
        currentTravelDirection,
        -sampledCurvature.dot(currentTravelDirection),
      );
      const magnitude = sampledCurvature.length();
      if (magnitude > MAXIMUM_CURVATURE_PER_METER)
        sampledCurvature.multiplyScalar(
          MAXIMUM_CURVATURE_PER_METER / magnitude,
        );
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
    constrainCeiling = true,
  ): void {
    const decay = Math.exp(-distance / CURVATURE_DECAY_METERS);
    position
      .copy(origin)
      .addScaledVector(corridorCorrection, distance)
      .addScaledVector(currentTravelDirection, distance)
      .addScaledVector(
        curvature,
        CURVATURE_DECAY_METERS * distance -
          CURVATURE_DECAY_METERS ** 2 * (1 - decay),
      );
    tangent
      .copy(currentTravelDirection)
      .add(corridorCorrection)
      .addScaledVector(curvature, CURVATURE_DECAY_METERS * (1 - decay));
    if (constrainCeiling && options.maximumGoalYAt) {
      const ceiling = options.maximumGoalYAt(position.x, position.z);
      if (position.y > ceiling) {
        position.y = ceiling;
        tangent.y = 0;
      }
    }
    tangent.normalize();
  }

  function placeGoal(): boolean {
    const course = parameters.course;
    origin.copy(viewpoint.worldPosition);
    goalUp.copy(viewpoint.worldUp);
    const radius = sample(course.radiusMeters);
    const halfAngle = Math.max(0.05, viewpoint.viewHalfAngleRadians * 0.75);
    const distance = Math.max(
      sample(
        observation.goalIndex === 0
          ? course.firstDistanceMeters
          : course.spacingMeters,
      ),
      (radius * 2) / Math.tan(halfAngle),
    );
    corridorCorrection.set(0, 0, 0);
    // Derive the view correction from the uncut forecast. Applying it to an
    // already ceiling-clipped point would lose the original vertical offset.
    predictPosition(distance, targetPosition, predictedTangent, false);
    predictedOffset.copy(targetPosition).sub(origin);
    const predictionAngle = predictedOffset.angleTo(viewpoint.worldDirection);
    const visibleAngle = Math.max(
      0,
      halfAngle - Math.atan((radius * 1.6) / distance),
    );
    if (predictionAngle > visibleAngle) {
      targetOffset
        .copy(predictedOffset)
        .normalize()
        .lerp(viewpoint.worldDirection, 1 - visibleAngle / predictionAngle)
        .normalize()
        .multiplyScalar(predictedOffset.length());
      corridorCorrection
        .copy(targetOffset)
        .sub(predictedOffset)
        .multiplyScalar(1 / distance);
    }
    predictPosition(distance, targetPosition, predictedTangent);
    targetOffset.copy(targetPosition).sub(origin);
    const depth = targetOffset.dot(viewpoint.worldDirection);
    const lateral = Math.sqrt(
      Math.max(0, targetOffset.lengthSq() - depth * depth),
    );
    // Constrain the forecast corridor for the assisted view, keeping its measured
    // turn trend. Ceiling clipping can still make this gaze unreachable.
    if (
      depth <= 0 ||
      lateral + radius * 1.6 > depth * Math.tan(viewpoint.viewHalfAngleRadians)
    )
      return false;
    goalPosition.copy(targetPosition);
    goalNormal.copy(predictedTangent).negate();
    particleFrame.ringRadiusMeters = radius;
    particleFrame.previews = previews;
    previewStartedSeconds = particleFrame.elapsedSeconds;
    for (const [index, preview] of previews.entries()) {
      preview.crossingAgeSeconds = undefined;
      predictPosition(
        distance * (0.55 + index * 0.14),
        preview.goalPosition,
        preview.goalNormal,
      );
      preview.goalNormal.negate();
      targetOffset.copy(preview.goalPosition).sub(origin);
      const previewDepth = targetOffset.dot(viewpoint.worldDirection);
      const previewLateral = Math.sqrt(
        Math.max(0, targetOffset.lengthSq() - previewDepth * previewDepth),
      );
      preview.ringRadiusMeters = Math.min(
        radius,
        Math.max(
          0,
          (previewDepth * Math.tan(viewpoint.viewHalfAngleRadians * 0.9) -
            previewLateral) /
            1.6,
        ),
      );
    }
    return true;
  }

  function placeArrow(): void {
    origin.copy(viewpoint.worldPosition);
    arrowUp.copy(viewpoint.worldUp);
    arrowNormal.copy(viewpoint.worldDirection).negate();
    approachDirection.copy(currentTravelDirection);
    const direction = observation.direction;
    const horizontal = direction === "right" || direction === "left";
    turnDirection.copy(
      horizontal
        ? turnDirection
            .crossVectors(viewpoint.worldDirection, arrowUp)
            .normalize()
        : arrowUp,
    );
    if (direction === "left" || direction === "down") turnDirection.negate();
    // Enough lead distance to lean and turn before reaching the cue's plane.
    const distance = Math.max(
      12,
      (parameters.particles?.arrowLengthMeters ?? 6) /
        Math.tan(Math.max(0.1, viewpoint.viewHalfAngleRadians)),
    );
    corridorCorrection.set(0, 0, 0);
    predictPosition(distance, arrowPosition, predictedTangent);
    targetOffset.copy(arrowPosition).sub(origin);
    const predictionAngle = targetOffset.angleTo(viewpoint.worldDirection);
    const visibleAngle = Math.max(
      0,
      viewpoint.viewHalfAngleRadians * 0.5 -
        Math.atan(
          ((parameters.particles?.arrowLengthMeters ?? 6) * 0.5) / distance,
        ),
    );
    // Keep the primary instruction discoverable when the headset looks away
    // from travel; the tunnel itself still follows measured motion.
    if (predictionAngle > visibleAngle) {
      targetOffset
        .normalize()
        .lerp(viewpoint.worldDirection, 1 - visibleAngle / predictionAngle)
        .normalize();
      arrowPosition.copy(origin).addScaledVector(targetOffset, distance);
    }
    // During the cue this is a steering hint, not an active passage target.
    targetPosition
      .copy(origin)
      .addScaledVector(approachDirection, distance)
      .addScaledVector(turnDirection, distance * 0.5);
    goalPosition.copy(targetPosition);
    particleFrame.arrowAngleRadians =
      direction === "right"
        ? 0
        : direction === "left"
          ? Math.PI
          : direction === "up"
            ? Math.PI / 2
            : -Math.PI / 2;
    particleFrame.arrowPresence = 1;
    particleFrame.arrowFormation = 0;
    particleFrame.ringPresence = 0;
    particleFrame.previews = [];
    particleFrame.sectionPresence = 1;
    turnSeconds = 0;
    arrowOutsideSeconds = 0;
  }

  function miss(): void {
    observation.phase = "missed";
    dissolutionFormation = observation.formationProgress;
    arrowDissolutionFormation = particleFrame.arrowFormation;
    observation.missCount += 1;
    observation.wake = undefined;
    phaseSeconds = 0;
  }

  function sample([minimum, maximum]: DistanceRange): number {
    return minimum + (maximum - minimum) * random();
  }

  function update(deltaSeconds: number): void {
    if (!loaded || !active) return;
    if (!initialized) {
      previousPosition.copy(viewpoint.worldPosition);
      initialized = true;
    }
    const elapsed =
      playing && Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    particleFrame.elapsedSeconds += elapsed;
    phaseSeconds += elapsed;
    if (observation.wake) wake.ageSeconds += elapsed;
    travel.copy(viewpoint.worldPosition).sub(previousPosition);
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
      )
        preview.crossingAgeSeconds = 0;
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
        travel.lengthSq() > MINIMUM_TRAVEL_SQUARED
      ) {
        currentTravelDirection.copy(travel).normalize();
        const turn =
          currentTravelDirection.dot(turnDirection) -
          approachDirection.dot(turnDirection);
        turnSeconds = turn >= TURN_COMPONENT ? turnSeconds + elapsed : 0;
        if (turnSeconds >= TURN_CONFIRM_SECONDS && placeGoal()) {
          arrowDissolutionFormation = particleFrame.arrowFormation;
          particleFrame.ringPresence = 1;
          observation.phase = "forming";
          phaseSeconds = 0;
        }
      }
      targetOffset.copy(arrowPosition).sub(viewpoint.worldPosition);
      const inView =
        targetOffset.angleTo(viewpoint.worldDirection) <
        viewpoint.viewHalfAngleRadians;
      arrowOutsideSeconds = inView ? 0 : arrowOutsideSeconds + elapsed;
      if (
        observation.phase === "turning" &&
        (arrowOutsideSeconds >= ARROW_OUT_OF_VIEW_SECONDS ||
          targetOffset.dot(arrowNormal) > 0 ||
          targetOffset.length() > viewpoint.viewDistanceMeters)
      )
        miss();
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
          particleFrame.arrowPresence = 0;
        }
        phaseSeconds = 0;
      }
    }
    if (
      observation.phase === "forming" ||
      observation.phase === "flying" ||
      observation.phase === "crossed"
    ) {
      particleFrame.arrowPresence = Math.max(
        0,
        1 -
          (particleFrame.elapsedSeconds - previewStartedSeconds) /
            ARROW_FADE_SECONDS,
      );
      particleFrame.arrowFormation =
        arrowDissolutionFormation * particleFrame.arrowPresence;
    } else if (observation.phase === "missed") {
      particleFrame.arrowPresence = Math.min(
        particleFrame.arrowPresence,
        Math.max(0, 1 - phaseSeconds / parameters.dissolutionSeconds),
      );
      particleFrame.arrowFormation =
        arrowDissolutionFormation * particleFrame.arrowPresence;
      particleFrame.ringPresence = particleFrame.previews.length
        ? particleFrame.sectionPresence
        : 0;
    }
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
