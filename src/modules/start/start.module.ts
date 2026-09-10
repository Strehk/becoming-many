import { Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing, type FlightRing } from "./flight-ring-crossing";
import { StartArrows } from "./start-arrows";
import { StartCourse } from "./start-course";
import { StartMotion } from "./start-motion";
import type {
  StartParticleObjects,
  StartParticleWake,
} from "./start-particle-frame";
import type { StartParticleEffect } from "./start-particles.effect";
import {
  START_SETTINGS,
  type StartDirection,
  type StartMotionLimits,
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
/** Observations borrow buffers until the next World frame; consumers must not mutate them. */
export type StartObservation = Readonly<StartModule["observation"]>;

export type StartModuleHandle = Readonly<
  Pick<
    StartModule,
    | "readObservation"
    | "setPlaying"
    | "setFormationAllowed"
    | "setGoalAdvanceAllowed"
    | "resetPractice"
    | "module"
  >
>;

export interface StartModuleOptions {
  readonly viewpoint: Viewpoint;
  readonly parameters: StartParameters;
  readonly motionLimits: StartMotionLimits;
  readonly arrowLengthMeters: number;
  /** Only Course consumes randomness; tests may supply a reproducible sampler. */
  readonly random?: () => number;
  /** Borrow Run's ceiling without changing flight limits. */
  readonly maximumGoalYAt?: (x: number, z: number) => number;
  /** Composition selects presentation; Start owns its complete lifetime. */
  readonly particles?: StartParticleEffect;
}

/** Construct the sole local learning orchestrator, driven exclusively by World's lifecycle. */
export function createStartModule(
  options: StartModuleOptions,
): StartModuleHandle {
  validateStartParameters(options.parameters);
  return new StartModule(options);
}

class StartModule {
  private readonly motion: StartMotion;
  private readonly course: StartCourse;
  private readonly arrows: StartArrows;
  private readonly prediction = {
    position: new Vector3(),
    tangent: new Vector3(),
    direction: new Vector3(),
    distance: 0,
  };
  private readonly targetOffset = new Vector3();
  private readonly wake = { direction: new Vector3(), ageSeconds: 0 };
  private playing = true;
  private phaseSeconds = 0;
  private turnSeconds = 0;
  private releaseFormation = 1;
  private formationAllowed = true;
  private goalAdvanceAllowed = true;
  private readonly previews;
  private readonly frame;
  readonly observation;
  readonly module: WorldModule = {
    load: () => {
      this.resetPractice();
      this.options.particles?.load();
    },
    activate: () => {
      this.motion.resetHistory();
      this.options.particles?.setVisible(true);
    },
    update: (deltaSeconds: number) => this.update(deltaSeconds),
    deactivate: () => {
      this.options.particles?.setVisible(false);
      this.observation.objects = undefined;
    },
    unload: () => {
      this.options.particles?.unload();
      this.observation.objects = undefined;
    },
  };

  constructor(private readonly options: StartModuleOptions) {
    this.motion = new StartMotion({
      viewpoint: options.viewpoint,
      limits: options.motionLimits,
      maximumGoalYAt: options.maximumGoalYAt,
    });
    this.course = new StartCourse({
      parameters: options.parameters,
      viewpoint: options.viewpoint,
      limits: options.motionLimits,
      arrowLengthMeters: options.arrowLengthMeters,
      random: options.random ?? Math.random,
      maximumGoalYAt: options.maximumGoalYAt,
    });
    this.arrows = new StartArrows(options.viewpoint, options.arrowLengthMeters);
    this.previews = this.course.previews.map((geometry) => ({
      goalPosition: geometry.goalPosition,
      goalNormal: geometry.goalNormal,
      goalUp: geometry.goalUp,
      get ringRadiusMeters() {
        return geometry.ringRadiusMeters;
      },
      crossingAgeSeconds: undefined as number | undefined,
    }));
    this.frame = this.createFrame();
    this.observation = this.createObservation();
  }

  readObservation = (): StartObservation => this.observation;

  /** Freeze learning/presentation; Run separately freezes locomotion. */
  setPlaying = (next: boolean): void => {
    if (this.playing !== next) this.motion.resetHistory();
    this.playing = next;
  };

  /** Show opens formation at the spoken instruction. */
  setFormationAllowed = (allowed: boolean): void => {
    this.formationAllowed = allowed;
  };
  /** Show releases a completed goal after its spoken instruction. */
  setGoalAdvanceAllowed = (allowed: boolean): void => {
    this.goalAdvanceAllowed = allowed;
  };

  /** Reset the current pose's lesson; allocated presentation resources stay with Start. */
  resetPractice = (): void => {
    this.motion.resetHistory("restart");
    this.formationAllowed = true;
    this.goalAdvanceAllowed = true;
    this.turnSeconds = 0;
    this.frame.elapsedSeconds = 0;
    this.frame.previewElapsedSeconds = 0;
    this.frame.formationProgress = 0;
    this.frame.ringPresence = 0;
    this.frame.previews = [];
    this.frame.wake = undefined;
    this.arrows.reset();
    this.observation.goalIndex = 0;
    this.observation.crossingCount = 0;
    this.observation.passageCount = 0;
    this.observation.attempt = 0;
    this.observation.passagePosition.set(0, 0, 0);
    this.observation.objects = undefined;
    this.enterPhase("arrival");
  };

  /** Sample movement, detect passages, advance one phase, retire cues, then publish presentation. */
  private update(deltaSeconds: number): void {
    const elapsed =
      this.playing && Number.isFinite(deltaSeconds)
        ? Math.max(0, deltaSeconds)
        : 0;
    this.frame.elapsedSeconds += elapsed;
    this.frame.previewElapsedSeconds += elapsed;
    this.phaseSeconds += elapsed;
    if (this.frame.wake) this.wake.ageSeconds += elapsed;
    this.motion.update(elapsed);
    this.updatePreviewPassages(elapsed);
    this.advanceLesson(elapsed);
    this.arrows.update(
      elapsed,
      this.observation.phase === "turning" && this.phaseSeconds === 0,
    );
    if (
      this.observation.phase === "turning" &&
      this.arrows.current.fadeSeconds >= 0
    )
      this.missGoal();
    if (this.observation.phase === "missed")
      this.frame.ringPresence = this.frame.previews.length
        ? 1 - this.progress(this.options.parameters.dissolutionSeconds)
        : 0;
    if (this.hasPassedGoal()) this.missGoal();
    this.options.particles?.update(this.frame);
    this.observation.objects = this.options.particles?.readObjectAnchors();
  }

  /** Each dispatch ends this frame's learning step; a newly entered phase waits for the next frame. */
  private advanceLesson(elapsed: number): void {
    switch (this.observation.phase) {
      case "arrival":
        this.beginAttempt();
        return;
      case "turning":
        this.confirmTurn(elapsed);
        return;
      case "forming":
        this.frame.formationProgress = this.progress(
          this.options.parameters.formationSeconds,
        );
        if (this.frame.formationProgress === 1) this.enterPhase("flying");
        return;
      case "flying":
        this.crossGoal();
        return;
      case "crossed":
      case "missed":
        this.finishAttempt();
        return;
      case "complete":
        return;
    }
  }

  private beginAttempt(): void {
    if (
      !this.playing ||
      !this.formationAllowed ||
      this.progress(this.options.parameters.arrivalSeconds) < 1
    )
      return;
    this.arrows.replace();
    this.prediction.distance = this.course.arrowDistance(
      this.observation.goalIndex,
    );
    this.motion.predictPosition(
      this.options.viewpoint.worldPosition,
      this.prediction.distance,
      this.prediction,
    );
    this.prediction.direction.copy(this.motion.direction);
    this.course.placeArrow(
      this.observation.direction,
      this.prediction,
      this.arrows.current,
    );
    this.frame.ringPresence = 0;
    this.frame.previews = [];
    this.turnSeconds = 0;
    this.enterPhase("turning");
  }

  private confirmTurn(elapsed: number): void {
    const { motion, course } = this;
    this.arrows.current.formation = this.progress(
      this.options.parameters.formationSeconds,
    );
    if (
      !this.playing ||
      this.arrows.current.formation < 1 ||
      motion.flightTravel.lengthSq() <= START_SETTINGS.minimumTravelSquared
    )
      return;
    const turn =
      motion.direction.dot(course.turnDirection) -
      course.approachDirection.dot(course.turnDirection);
    this.turnSeconds =
      turn >= START_SETTINGS.turnComponent ? this.turnSeconds + elapsed : 0;
    if (
      this.turnSeconds < START_SETTINGS.turnConfirmSeconds ||
      !course.placeGoal(motion.direction, motion.curvature, motion.speed)
    )
      return;
    for (const preview of this.previews) preview.crossingAgeSeconds = undefined;
    this.frame.previews = this.previews;
    this.frame.previewElapsedSeconds = 0;
    this.frame.ringPresence = 1;
    this.enterPhase("forming");
  }

  private crossGoal(): void {
    if (!this.playing || !this.crosses(this.course)) return;
    this.observation.crossingCount += 1;
    this.recordPassage(this.course.goalPosition);
    this.wake.direction.copy(this.motion.eyeTravel).normalize();
    this.wake.ageSeconds = 0;
    this.frame.wake = this.wake;
    this.releaseFormation = 1;
    this.enterPhase("crossed");
  }

  private finishAttempt(): void {
    const { dissolutionSeconds, directions } = this.options.parameters;
    this.frame.formationProgress =
      this.releaseFormation * (1 - this.progress(dissolutionSeconds));
    if (
      this.phaseSeconds < dissolutionSeconds ||
      (this.observation.phase === "crossed" && !this.goalAdvanceAllowed)
    )
      return;
    this.frame.ringPresence = 0;
    if (this.observation.phase === "missed") this.observation.attempt += 1;
    else if (this.observation.goalIndex + 1 === directions.length) {
      this.frame.previews = [];
      this.enterPhase("complete");
      return;
    } else {
      this.observation.goalIndex += 1;
      this.frame.wake = undefined;
    }
    this.enterPhase("arrival");
  }

  /** Decorative passages produce local feedback without advancing the lesson. */
  private updatePreviewPassages(elapsed: number): void {
    for (const preview of this.previews) {
      if (preview.crossingAgeSeconds !== undefined)
        preview.crossingAgeSeconds += elapsed;
      else if (
        this.playing &&
        this.observation.phase === "flying" &&
        this.crosses(preview)
      ) {
        preview.crossingAgeSeconds = 0;
        this.recordPassage(preview.goalPosition);
      }
    }
  }

  private crosses(ring: FlightRing): boolean {
    return crossesFlightRing(
      this.motion.previousEye,
      this.options.viewpoint.worldPosition,
      ring,
    );
  }

  private hasPassedGoal(): boolean {
    const { viewpoint } = this.options;
    this.targetOffset
      .copy(viewpoint.worldPosition)
      .sub(this.course.goalPosition);
    return (
      this.playing &&
      (this.observation.phase === "flying" ||
        this.observation.phase === "forming") &&
      this.motion.eyeTravel.lengthSq() > 0 &&
      (this.targetOffset.dot(this.course.goalNormal) <
        -this.frame.ringRadiusMeters ||
        (this.targetOffset.lengthSq() > viewpoint.viewDistanceMeters ** 2 &&
          this.targetOffset.dot(this.motion.eyeTravel) > 0))
    );
  }

  private missGoal(): void {
    this.releaseFormation = this.frame.formationProgress;
    this.frame.wake = undefined;
    this.enterPhase("missed");
  }

  private recordPassage(position: Vector3): void {
    this.observation.passageCount += 1;
    this.observation.passagePosition.copy(position);
  }

  private enterPhase(phase: StartPhase): void {
    this.observation.phase = phase;
    this.phaseSeconds = 0;
  }

  private progress(durationSeconds: number): number {
    return Math.min(1, this.phaseSeconds / durationSeconds);
  }

  private createFrame() {
    const course = this.course;
    return {
      elapsedSeconds: 0,
      previewElapsedSeconds: 0,
      goalPosition: this.course.goalPosition,
      goalNormal: this.course.goalNormal,
      goalUp: this.course.goalUp,
      get ringRadiusMeters() {
        return course.ringRadiusMeters;
      },
      formationProgress: 0,
      ringPresence: 0,
      arrow: this.arrows.current,
      retiringArrow: this.arrows.retiring,
      previews: [] as typeof this.previews,
      wake: undefined as StartParticleWake | undefined,
    };
  }

  private createObservation() {
    const start = this;
    return {
      phase: "arrival" as StartPhase,
      goalIndex: 0,
      get direction(): StartDirection {
        return (
          start.options.parameters.directions[start.observation.goalIndex] ??
          start.options.parameters.directions[0]
        );
      },
      /** Cue entrance while turning; final ring center after formation. */
      goalPosition: this.course.goalPosition as Readonly<Vector3>,
      crossingCount: 0,
      passageCount: 0,
      passagePosition: new Vector3(),
      attempt: 0,
      objects: undefined as StartParticleObjects | undefined,
      get formationProgress() {
        return start.frame.formationProgress;
      },
      get arrowFormationProgress() {
        return start.arrows.current.formation * start.arrows.current.presence;
      },
    };
  }
}
