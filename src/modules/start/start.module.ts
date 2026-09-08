import { type Group, Quaternion, Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-goals";
import type {
  StartParticleEffect,
  StartParticleObjects,
  StartParticleParameters,
} from "./start-particles.effect";

export type StartDirection = "right" | "left" | "up" | "down";

type DistanceRange = readonly [minimum: number, maximum: number];

export interface StartParameters {
  readonly directions: readonly [StartDirection, ...StartDirection[]];
  /** Sampled once per goal, relative to the previous goal in the arrival heading. */
  readonly course: {
    readonly firstDistanceMeters: DistanceRange;
    readonly spacingMeters: DistanceRange;
    readonly horizontalOffsetMeters: DistanceRange;
    readonly verticalOffsetMeters: DistanceRange;
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
  | "forming"
  | "flying"
  | "crossed"
  | "complete";

/** Borrowed until the next World frame; consumers must not retain or mutate it. */
export interface StartObservation {
  readonly phase: StartPhase;
  readonly goalIndex: number;
  readonly direction: StartDirection;
  readonly goalPosition: Readonly<Vector3>;
  /** Fixed passage target, including while particles are arriving. */
  readonly goalTarget: Readonly<Vector3>;
  readonly formationProgress: number;
  readonly crossingCount: number;
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
  /** Forget the old movement segment when Run resets its flight pose. */
  readonly reset: () => void;
}

interface StartModuleOptions {
  /** Optional reproducible sampling; only goal creation consumes randomness. */
  readonly random?: () => number;
  readonly viewpoint: Viewpoint;
  readonly viewerRig: Group;
  readonly parameters: StartParameters;
  /** Composition selects presentation; this module owns its complete lifetime. */
  readonly particles?: StartParticleEffect;
}

/** Spatial learning inside World's existing lifetime and frame loop. */
export function createStartModule(
  options: StartModuleOptions,
): StartModuleHandle {
  const { parameters, particles, viewpoint, viewerRig } = options;
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
  const courseOffset = new Vector3();
  const initialHeading = new Quaternion();
  const previousPosition = new Vector3();
  const previousGoalPosition = new Vector3();
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
    crossingCount: 0,
    objects: undefined as StartParticleObjects | undefined,
    wake: undefined as StartObservation["wake"],
  };
  const particleFrame = {
    elapsedSeconds: 0,
    goalPosition,
    goalNormal,
    ringRadiusMeters: parameters.course.radiusMeters[0],
    arrowAngleRadians: 0,
    formationProgress: 0,
    completionProgress: 0,
    wake: undefined as StartObservation["wake"],
  };
  let loaded = false;
  let active = false;
  let playing = true;
  let initialized = false;
  let phaseSeconds = 0;
  let goalAdvanceAllowed = true;

  return {
    readObservation: () => observation,
    setPlaying: (next) => {
      if (playing !== next) previousPosition.copy(viewpoint.worldPosition);
      playing = next;
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
        previousPosition.copy(viewpoint.worldPosition);
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
    courseOffset.set(0, 0, 0);
    goalAdvanceAllowed = true;
    phaseSeconds = 0;
    particleFrame.elapsedSeconds = 0;
    observation.phase = "arrival";
    observation.goalIndex = 0;
    observation.direction = parameters.directions[0];
    observation.formationProgress = 0;
    observation.crossingCount = 0;
    observation.wake = undefined;
    observation.objects = undefined;
  }

  function placeGoal(): void {
    const direction = parameters.directions[observation.goalIndex];
    if (!direction)
      throw new Error("Start goal index is outside its lesson sequence");
    const course = parameters.course;
    courseOffset.z -= sample(
      observation.goalIndex === 0
        ? course.firstDistanceMeters
        : course.spacingMeters,
    );
    if (direction === "right" || direction === "left")
      courseOffset.x +=
        sample(course.horizontalOffsetMeters) *
        (direction === "right" ? 1 : -1);
    else
      courseOffset.y +=
        sample(course.verticalOffsetMeters) * (direction === "up" ? 1 : -1);
    targetPosition
      .copy(courseOffset)
      .applyQuaternion(initialHeading)
      .add(origin);
    observation.direction = direction;
    particleFrame.arrowAngleRadians =
      direction === "right"
        ? 0
        : direction === "left"
          ? Math.PI
          : direction === "up"
            ? Math.PI / 2
            : -Math.PI / 2;
    particleFrame.ringRadiusMeters = sample(course.radiusMeters);
  }

  function sample([minimum, maximum]: DistanceRange): number {
    return minimum + (maximum - minimum) * random();
  }

  function update(deltaSeconds: number): void {
    if (!loaded || !active) return;
    if (!initialized) {
      origin.copy(viewpoint.worldPosition);
      initialHeading.copy(viewerRig.quaternion);
      previousPosition.copy(viewpoint.worldPosition);
      goalNormal.set(0, 0, 1).applyQuaternion(initialHeading);
      placeGoal();
      previousGoalPosition.copy(targetPosition);
      initialized = true;
    }
    const elapsed =
      playing && Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    particleFrame.elapsedSeconds += elapsed;
    phaseSeconds += elapsed;
    if (observation.wake) wake.ageSeconds += elapsed;

    if (observation.phase === "arrival") {
      const progress = Math.min(1, phaseSeconds / parameters.arrivalSeconds);
      goalPosition.lerpVectors(
        previousGoalPosition,
        targetPosition,
        progress * progress * (3 - 2 * progress),
      );
      if (playing && progress === 1) {
        observation.phase = "forming";
        phaseSeconds = 0;
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
      phaseSeconds = 0;
    } else if (observation.phase === "crossed") {
      observation.formationProgress =
        1 - Math.min(1, phaseSeconds / parameters.dissolutionSeconds);
      if (observation.formationProgress === 0 && goalAdvanceAllowed) {
        if (observation.goalIndex + 1 === parameters.directions.length)
          observation.phase = "complete";
        else {
          previousGoalPosition.copy(targetPosition);
          observation.goalIndex += 1;
          placeGoal();
          observation.phase = "arrival";
          observation.wake = undefined;
        }
        phaseSeconds = 0;
      }
    }
    previousPosition.copy(viewpoint.worldPosition);
    if (!particles) return;
    particleFrame.formationProgress = observation.formationProgress;
    particleFrame.completionProgress = observation.phase === "crossed" ? 1 : 0;
    particleFrame.wake = observation.wake;
    particles?.update(particleFrame);
    observation.objects = particles.readObjectAnchors();
  }
}
