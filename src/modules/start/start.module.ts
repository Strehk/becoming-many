import { Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-ring-crossing";
import { createStartArrows } from "./start-arrows";
import { createStartCourse } from "./start-course";
import { createStartMotion } from "./start-motion";
import type {
  StartParticleObjects,
  StartParticleWake,
} from "./start-particle-frame";
import { START_PARTICLE_SETTINGS } from "./start-particle-settings";
import type { StartParticleEffect } from "./start-particles.effect";
import {
  START_SETTINGS,
  type StartDirection,
  type StartParameters,
  validateStartParameters,
} from "./start-settings";

export type StartPhase =
  | "arrival"
  | "turning"
  | "forming"
  | "flying"
  | "crossed"
  | "missed"
  | "complete";

/** Borrowed until the next World frame. Show and audio may read, but never retain or mutate it. */
export interface StartObservation {
  readonly phase: StartPhase;
  readonly goalIndex: number;
  readonly direction: StartDirection;
  /** Fixed cue entrance during turning; final ring center once the course forms. */
  readonly goalPosition: Readonly<Vector3>;
  readonly formationProgress: number;
  readonly arrowFormationProgress: number;
  readonly crossingCount: number;
  /** Includes decorative ring passages, which never advance the lesson. */
  readonly passageCount: number;
  readonly passagePosition: Readonly<Vector3>;
  readonly attempt: number;
  readonly missCount: number;
  readonly objects?: StartParticleObjects;
  readonly wake: StartParticleWake | undefined;
}

export interface StartModuleHandle {
  readonly module: WorldModule;
  readonly readObservation: () => StartObservation;
  /** Freeze learning/presentation; Run separately freezes locomotion. */
  readonly setPlaying: (playing: boolean) => void;
  /** Show opens these gates at the spoken instruction and after its completion. */
  readonly setFormationAllowed: (allowed: boolean) => void;
  readonly setGoalAdvanceAllowed: (allowed: boolean) => void;
  /** Reset practice at the current flight pose, retaining the loaded particle resources. */
  readonly resetPractice: () => void;
}

interface StartModuleOptions {
  readonly viewpoint: Viewpoint;
  readonly parameters: StartParameters;
  /** Only placement consumes randomness; tests may supply a reproducible sampler. */
  readonly random?: () => number;
  /** Borrow Run's flight ceiling; course generation never changes flight limits. */
  readonly maximumGoalYAt?: (x: number, z: number) => number;
  /** Composition selects the presentation; Start owns its complete lifetime. */
  readonly particles?: StartParticleEffect;
}

/** Own learning and the World lifecycle. Motion, course and arrows have no independent clock. */
export function createStartModule(
  options: StartModuleOptions,
): StartModuleHandle {
  const { viewpoint, parameters, particles } = options;
  validateStartParameters(parameters);
  const motion = createStartMotion(viewpoint, options.maximumGoalYAt);
  const course = createStartCourse(
    parameters,
    viewpoint,
    motion,
    options.random ?? Math.random,
    options.maximumGoalYAt,
  );
  const arrows = createStartArrows(
    viewpoint,
    parameters.particles?.arrowLengthMeters ??
      START_PARTICLE_SETTINGS.arrowLengthMeters,
    {
      position: course.arrowPosition,
      normal: course.arrowNormal,
      up: course.arrowUp,
    },
  );
  const previousEye = new Vector3();
  const previousFlight = new Vector3();
  const eyeTravel = new Vector3();
  const flightTravel = new Vector3();
  const targetOffset = new Vector3();
  const wake = {
    direction: new Vector3(),
    ageSeconds: 0,
  };
  const frame = {
    elapsedSeconds: 0,
    previewElapsedSeconds: 0,
    goalPosition: course.goalPosition,
    goalNormal: course.goalNormal,
    goalUp: course.goalUp,
    ringRadiusMeters: parameters.course.radiusMeters[0],
    formationProgress: 0,
    ringPresence: 0,
    arrow: arrows.current,
    retiringArrow: arrows.retiring,
    previews: [] as typeof course.previews,
    wake: undefined as StartParticleWake | undefined,
  };
  const observation = {
    phase: "arrival" as StartPhase,
    goalIndex: 0,
    direction: parameters.directions[0],
    goalPosition: course.goalPosition,
    crossingCount: 0,
    passageCount: 0,
    passagePosition: new Vector3(),
    attempt: 0,
    missCount: 0,
    objects: undefined as StartParticleObjects | undefined,
    get formationProgress() {
      return frame.formationProgress;
    },
    get arrowFormationProgress() {
      return arrows.current.formation * arrows.current.presence;
    },
    get wake() {
      return frame.wake;
    },
  };
  let playing = true;
  let active = false;
  let loaded = false;
  let initialized = false;
  let phaseSeconds = 0;
  let turnSeconds = 0;
  let releaseFormation = 1;
  let formationAllowed = true;
  let goalAdvanceAllowed = true;

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
    resetPractice,
    module: {
      load: () => {
        resetPractice();
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

  /** Read movement, advance one lesson phase, retire abandoned cues, then publish presentation. */
  function update(deltaSeconds: number): void {
    if (!loaded || !active) return;
    if (!initialized) {
      rememberPose();
      initialized = true;
    }
    const elapsed =
      playing && Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    frame.elapsedSeconds += elapsed;
    frame.previewElapsedSeconds += elapsed;
    phaseSeconds += elapsed;
    if (frame.wake) wake.ageSeconds += elapsed;
    eyeTravel.copy(viewpoint.worldPosition).sub(previousEye);
    flightTravel
      .copy(viewpoint.worldFlightPosition ?? viewpoint.worldPosition)
      .sub(previousFlight);
    motion.update(flightTravel, elapsed);
    updatePreviewPassages(elapsed);
    advanceLesson(elapsed);
    arrows.update(
      elapsed,
      observation.phase === "turning" && phaseSeconds === 0,
    );
    if (observation.phase === "turning" && arrows.current.fadeSeconds >= 0)
      missGoal();
    if (observation.phase === "missed")
      frame.ringPresence = frame.previews.length
        ? 1 - progress(parameters.dissolutionSeconds)
        : 0;
    targetOffset.copy(viewpoint.worldPosition).sub(course.goalPosition);
    if (
      playing &&
      (observation.phase === "flying" || observation.phase === "forming") &&
      eyeTravel.lengthSq() > 0 &&
      (targetOffset.dot(course.goalNormal) < -frame.ringRadiusMeters ||
        (targetOffset.lengthSq() > viewpoint.viewDistanceMeters ** 2 &&
          targetOffset.dot(eyeTravel) > 0))
    )
      missGoal();
    rememberPose();
    if (!particles) return;
    particles.update(frame);
    observation.objects = particles.readObjectAnchors();
  }

  /** Each branch ends the frame's learning step; a newly entered phase starts on the next frame. */
  function advanceLesson(elapsed: number): void {
    switch (observation.phase) {
      case "arrival":
        if (
          !playing ||
          !formationAllowed ||
          progress(parameters.arrivalSeconds) < 1
        )
          return;
        arrows.replace();
        course.placeArrow(observation.direction, observation.goalIndex);
        frame.ringPresence = 0;
        frame.previews = [];
        turnSeconds = 0;
        enterPhase("turning");
        return;
      case "turning": {
        arrows.current.formation = progress(parameters.formationSeconds);
        if (
          !playing ||
          arrows.current.formation < 1 ||
          flightTravel.lengthSq() <= START_SETTINGS.minimumTravelSquared
        )
          return;
        const turn =
          motion.direction.dot(course.turnDirection) -
          course.approachDirection.dot(course.turnDirection);
        turnSeconds =
          turn >= START_SETTINGS.turnComponent ? turnSeconds + elapsed : 0;
        if (
          turnSeconds < START_SETTINGS.turnConfirmSeconds ||
          !course.placeGoal()
        )
          return;
        frame.ringRadiusMeters = course.ringRadiusMeters;
        frame.previews = course.previews;
        frame.previewElapsedSeconds = 0;
        frame.ringPresence = 1;
        enterPhase("forming");
        return;
      }
      case "forming":
        frame.formationProgress = progress(parameters.formationSeconds);
        if (frame.formationProgress === 1) enterPhase("flying");
        return;
      case "flying": {
        if (!playing) return;
        const crossed = crossesFlightRing(
          previousEye,
          viewpoint.worldPosition,
          course.goalPosition,
          course.goalNormal,
          frame.ringRadiusMeters,
        );
        if (!crossed) return;
        observation.crossingCount += 1;
        recordPassage(course.goalPosition);
        wake.direction.copy(eyeTravel).normalize();
        wake.ageSeconds = 0;
        frame.wake = wake;
        releaseFormation = 1;
        enterPhase("crossed");
        return;
      }
      case "crossed":
      case "missed": {
        frame.formationProgress =
          releaseFormation * (1 - progress(parameters.dissolutionSeconds));
        if (
          phaseSeconds < parameters.dissolutionSeconds ||
          (observation.phase === "crossed" && !goalAdvanceAllowed)
        )
          return;
        const missed = observation.phase === "missed";
        frame.ringPresence = 0;
        if (missed) observation.attempt += 1;
        else if (observation.goalIndex + 1 === parameters.directions.length) {
          frame.previews = [];
          enterPhase("complete");
          return;
        } else {
          observation.goalIndex += 1;
          observation.direction =
            parameters.directions[observation.goalIndex] ??
            observation.direction;
          frame.wake = undefined;
        }
        enterPhase("arrival");
        return;
      }
      case "complete":
        return;
    }
  }

  /** Decorative passages produce local feedback, never lesson completion. */
  function updatePreviewPassages(elapsed: number): void {
    for (const preview of course.previews) {
      if (preview.crossingAgeSeconds !== undefined)
        preview.crossingAgeSeconds += elapsed;
      else if (
        playing &&
        observation.phase === "flying" &&
        crossesFlightRing(
          previousEye,
          viewpoint.worldPosition,
          preview.goalPosition,
          preview.goalNormal,
          preview.ringRadiusMeters,
        )
      ) {
        preview.crossingAgeSeconds = 0;
        recordPassage(preview.goalPosition);
      }
    }
  }

  function resetPractice(): void {
    initialized = false;
    resetMotionHistory();
    formationAllowed = true;
    goalAdvanceAllowed = true;
    turnSeconds = 0;
    frame.elapsedSeconds = 0;
    frame.previewElapsedSeconds = 0;
    frame.formationProgress = 0;
    frame.ringPresence = 0;
    frame.previews = [];
    frame.wake = undefined;
    arrows.resetArrows();
    observation.goalIndex = 0;
    observation.crossingCount = 0;
    observation.passageCount = 0;
    observation.attempt = 0;
    observation.missCount = 0;
    observation.direction = parameters.directions[0];
    observation.passagePosition.set(0, 0, 0);
    observation.objects = undefined;
    enterPhase("arrival");
  }

  function resetMotionHistory(): void {
    rememberPose();
    motion.resetHistory();
  }

  function rememberPose(): void {
    previousEye.copy(viewpoint.worldPosition);
    previousFlight.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
  }

  function missGoal(): void {
    releaseFormation = frame.formationProgress;
    observation.missCount += 1;
    frame.wake = undefined;
    enterPhase("missed");
  }

  function recordPassage(position: Vector3): void {
    observation.passageCount += 1;
    observation.passagePosition.copy(position);
  }

  function enterPhase(phase: StartPhase): void {
    observation.phase = phase;
    phaseSeconds = 0;
  }

  function progress(durationSeconds: number): number {
    return Math.min(1, phaseSeconds / durationSeconds);
  }
}
