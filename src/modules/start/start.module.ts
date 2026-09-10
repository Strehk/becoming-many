import { Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-goals";
import { createStartCourse } from "./start-course";
import { createStartMotion, MINIMUM_TRAVEL_SQUARED } from "./start-motion";
import type {
  StartParticleEffect,
  StartParticleObjects,
  StartParticleParameters,
} from "./start-particles.effect";

export type StartDirection = "right" | "left" | "up" | "down";

const TURN_COMPONENT = 0.12;
const TURN_CONFIRM_SECONDS = 0.2;
const ARROW_OUT_OF_VIEW_SECONDS = 2;
const ARROW_FADE_SECONDS = 3;

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

  const motion = createStartMotion(viewpoint, options.maximumGoalYAt);
  const course = createStartCourse(
    parameters,
    viewpoint,
    motion,
    options.random ?? Math.random,
    options.maximumGoalYAt,
  );
  const {
    goalPosition,
    targetPosition,
    goalNormal,
    goalUp,
    arrowPosition,
    arrowNormal,
    arrowUp,
    approachDirection,
    turnDirection,
    previews,
  } = course;
  const previousPosition = new Vector3();
  const previousFlightPosition = new Vector3();
  const flightTravel = new Vector3();
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
    motion.reset();
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
    course.placeArrow(observation.direction, observation.goalIndex);
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
    motion.update(flightTravel, elapsed);
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
          motion.direction.dot(turnDirection) -
          approachDirection.dot(turnDirection);
        turnSeconds = turn >= TURN_COMPONENT ? turnSeconds + elapsed : 0;
        if (turnSeconds >= TURN_CONFIRM_SECONDS && course.placeGoal()) {
          particleFrame.ringRadiusMeters = course.ringRadiusMeters;
          particleFrame.previews = previews;
          previewStartedSeconds = particleFrame.elapsedSeconds;
          observation.predictionSeconds = course.predictionSeconds;
          observation.predictionSpreadMeters = course.predictionSpreadMeters;
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
    particles.update(particleFrame);
    observation.objects = particles.readObjectAnchors();
  }
}
