import { type Group, Quaternion, Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { createHeadingPanelPose } from "../heading-panel-pose";
import { crossesFlightRing } from "./flight-goals";
import type {
  StartParticleEffect,
  StartParticleParameters,
} from "./start-particles.effect";

export interface StartGoal {
  readonly direction: "right" | "left" | "up" | "down";
  /** Offset from the arrival eye in the initial flight heading, in metres. */
  readonly offsetMeters: readonly [number, number, number];
  readonly radiusMeters: number;
}

export interface StartParameters {
  readonly goals: readonly [StartGoal, ...StartGoal[]];
  readonly arrivalSeconds: number;
  readonly formationSeconds: number;
  readonly dissolutionSeconds: number;
  readonly guideDistanceMeters: number;
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
  readonly direction: StartGoal["direction"];
  readonly goalPosition: Readonly<Vector3>;
  readonly formationProgress: number;
  readonly crossingCount: number;
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
  readonly viewpoint: Viewpoint;
  readonly viewerRig: Group;
  readonly viewPitchDegrees: number;
  readonly parameters: StartParameters;
  /** Composition selects presentation; this module owns its complete lifetime. */
  readonly particles?: StartParticleEffect;
}

/** Spatial learning inside World's existing lifetime and frame loop. */
export function createStartModule(
  options: StartModuleOptions,
): StartModuleHandle {
  const { parameters, particles, viewpoint, viewerRig } = options;
  const positive = [
    parameters.arrivalSeconds,
    parameters.formationSeconds,
    parameters.dissolutionSeconds,
    parameters.guideDistanceMeters,
  ];
  if (
    positive.some((number) => !Number.isFinite(number) || number <= 0) ||
    !parameters.goals.length ||
    parameters.goals.some(
      (goal) =>
        !Number.isFinite(goal.radiusMeters) ||
        goal.radiusMeters <= 0 ||
        goal.offsetMeters.some((number) => !Number.isFinite(number)),
    )
  )
    throw new Error(
      "Start needs finite positive timings, distances and spatial goals",
    );

  const origin = new Vector3();
  const initialHeading = new Quaternion();
  const previousPosition = new Vector3();
  const previousGoalPosition = new Vector3();
  const targetPosition = new Vector3();
  const goalPosition = new Vector3();
  const goalNormal = new Vector3();
  const arrowNormal = new Vector3();
  const relativeGoal = new Vector3();
  const inverseHeading = new Quaternion();
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
    direction: parameters.goals[0].direction,
    goalPosition,
    formationProgress: 0,
    crossingCount: 0,
    wake: undefined as StartObservation["wake"],
  };
  const guidePose = createHeadingPanelPose({
    distanceMeters: parameters.guideDistanceMeters,
    viewPitchDegrees: options.viewPitchDegrees,
  });
  const particleFrame = {
    elapsedSeconds: 0,
    goalPosition,
    goalNormal,
    arrowPosition: guidePose.position,
    arrowNormal,
    ringRadiusMeters: parameters.goals[0].radiusMeters,
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
      },
      unload: () => {
        active = false;
        loaded = false;
        particles?.unload();
      },
    },
  };

  function reset(): void {
    initialized = false;
    goalAdvanceAllowed = true;
    phaseSeconds = 0;
    particleFrame.elapsedSeconds = 0;
    observation.phase = "arrival";
    observation.goalIndex = 0;
    observation.direction = parameters.goals[0].direction;
    observation.formationProgress = 0;
    observation.crossingCount = 0;
    observation.wake = undefined;
  }

  function placeGoal(): void {
    const goal = parameters.goals[observation.goalIndex];
    if (!goal)
      throw new Error("Start goal index is outside its authored capacity");
    targetPosition
      .fromArray(goal.offsetMeters)
      .applyQuaternion(initialHeading)
      .add(origin);
    observation.direction = goal.direction;
    particleFrame.ringRadiusMeters = goal.radiusMeters;
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
        if (observation.goalIndex + 1 === parameters.goals.length)
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
    guidePose.place(viewpoint.worldPosition, viewerRig.quaternion);
    arrowNormal.copy(guidePose.lookTarget).sub(guidePose.position).normalize();
    inverseHeading.copy(viewerRig.quaternion).invert();
    relativeGoal
      .copy(targetPosition)
      .sub(viewpoint.worldPosition)
      .applyQuaternion(inverseHeading);
    const pitch = (options.viewPitchDegrees * Math.PI) / 180;
    const projectedY =
      relativeGoal.y * Math.cos(pitch) + relativeGoal.z * Math.sin(pitch);
    // A missed goal behind the flight heading needs a turn-around cue, not a
    // misleading vertical projection. The goal stays fixed until crossed.
    particleFrame.arrowAngleRadians =
      relativeGoal.z > 0
        ? relativeGoal.x >= 0
          ? 0
          : Math.PI
        : Math.atan2(projectedY, relativeGoal.x);
    particleFrame.formationProgress = observation.formationProgress;
    particleFrame.completionProgress = observation.phase === "crossed" ? 1 : 0;
    particleFrame.wake = observation.wake;
    particles?.update(particleFrame);
  }
}
