import { Vector3 } from "three";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-ring-crossing";
import { createStartArrows } from "./start-arrows";
import { createStartCourse } from "./start-course";
import { createStartMotion } from "./start-motion";
import type {
  StartParticleObjects,
  StartParticleWake,
} from "./start-particle-frame";
import {
  START_SETTINGS,
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

/** Borrowed until the next World frame; consumers must not retain or mutate these buffers. */
export type StartObservation = Readonly<
  ReturnType<typeof createStartPractice>["observation"]
>;

export interface StartPracticeOptions {
  readonly viewpoint: Viewpoint;
  readonly parameters: StartParameters;
  /** Only placement consumes randomness; tests may supply a reproducible sampler. */
  readonly random?: () => number;
  /** Borrow Run's flight ceiling; course generation never changes flight limits. */
  readonly maximumGoalYAt?: (x: number, z: number) => number;
}

/** Advance the flight lesson on World time and publish reusable presentation buffers. */
export function createStartPractice(options: StartPracticeOptions) {
  const { viewpoint, parameters } = options;
  validateStartParameters(parameters);
  const motion = createStartMotion(viewpoint, options.maximumGoalYAt);
  const course = createStartCourse(
    parameters,
    viewpoint,
    motion,
    options.random ?? Math.random,
    options.maximumGoalYAt,
  );
  const arrows = createStartArrows(viewpoint, course.arrowLengthMeters, {
    position: course.arrowPosition,
    normal: course.arrowNormal,
    up: course.arrowUp,
  });
  const { previousEye, eyeTravel, flightTravel } = motion;
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
    get direction() {
      return (
        parameters.directions[observation.goalIndex] ?? parameters.directions[0]
      );
    },
    /** Cue entrance while turning; final ring center after formation. */
    goalPosition: course.goalPosition as Readonly<Vector3>,
    crossingCount: 0,
    /** Decorative passages produce feedback without advancing the lesson. */
    passageCount: 0,
    passagePosition: new Vector3(),
    attempt: 0,
    /** The module publishes anchors after updating the particle effect. */
    objects: undefined as StartParticleObjects | undefined,
    get formationProgress() {
      return frame.formationProgress;
    },
    get arrowFormationProgress() {
      return arrows.current.formation * arrows.current.presence;
    },
  };
  let playing = true;
  let phaseSeconds = 0;
  let turnSeconds = 0;
  let releaseFormation = 1;
  let formationAllowed = true;
  let goalAdvanceAllowed = true;

  return {
    observation,
    frame,
    update,
    resetMotionHistory: motion.resetHistory,
    /** Freeze learning/presentation; Run separately freezes locomotion. */
    setPlaying: (next: boolean) => {
      if (playing !== next) motion.resetHistory();
      playing = next;
    },
    /** Show opens formation at the spoken instruction. */
    setFormationAllowed: (allowed: boolean) => {
      formationAllowed = allowed;
    },
    /** Show releases the completed goal after its spoken instruction. */
    setGoalAdvanceAllowed: (allowed: boolean) => {
      goalAdvanceAllowed = allowed;
    },
    resetPractice,
  };

  /** Read movement, advance one lesson phase, retire abandoned cues, then publish presentation. */
  function update(deltaSeconds: number): void {
    const elapsed =
      playing && Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    frame.elapsedSeconds += elapsed;
    frame.previewElapsedSeconds += elapsed;
    phaseSeconds += elapsed;
    if (frame.wake) wake.ageSeconds += elapsed;
    motion.update(elapsed);
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
        frame.ringPresence = 0;
        if (observation.phase === "missed") observation.attempt += 1;
        else if (observation.goalIndex + 1 === parameters.directions.length) {
          frame.previews = [];
          enterPhase("complete");
          return;
        } else {
          observation.goalIndex += 1;
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

  /** Reset at the current pose; GPU resources remain with the module. */
  function resetPractice(): void {
    motion.resetHistory(true);
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
    observation.passagePosition.set(0, 0, 0);
    observation.objects = undefined;
    enterPhase("arrival");
  }

  function missGoal(): void {
    releaseFormation = frame.formationProgress;
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
