import { Matrix4, Quaternion, Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { crossesFlightRing } from "./flight-goals";
import type {
  StartParticleEffect,
  StartParticleObjects,
  StartParticleParameters,
} from "./start-particles.effect";

export type StartDirection = "right" | "left" | "up" | "down";

const ORIGIN = new Vector3();

type DistanceRange = readonly [minimum: number, maximum: number];

export interface StartParameters {
  /** Show limits integrated practice; standalone Start remains an independent test. */
  readonly maximumPracticeSeconds: number;
  readonly directions: readonly [StartDirection, ...StartDirection[]];
  /** Sampled per course section in the current view; live goals stay world-fixed. */
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
  | "missed"
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
  const courseOffset = new Vector3();
  const initialHeading = new Quaternion();
  const headingMatrix = new Matrix4();
  const goalUp = new Vector3();
  const previousPosition = new Vector3();
  const arrowPosition = new Vector3();
  const previews = Array.from({ length: 3 }, () => ({
    goalPosition: new Vector3(),
    goalNormal: new Vector3(),
    ringRadiusMeters: 0,
  }));
  const curveOffset = new Vector3();
  const forward = new Vector3();
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
    attempt: 0,
    missCount: 0,
    objects: undefined as StartParticleObjects | undefined,
    wake: undefined as StartObservation["wake"],
  };
  const particleFrame = {
    elapsedSeconds: 0,
    goalPosition,
    arrowPosition,
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
  const travel = new Vector3();
  const targetOffset = new Vector3();

  return {
    readObservation: () => observation,
    setPlaying: (next) => {
      if (playing !== next) previousPosition.copy(viewpoint.worldPosition);
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
    formationAllowed = true;
    phaseSeconds = 0;
    particleFrame.elapsedSeconds = 0;
    previewStartedSeconds = 0;
    observation.phase = "arrival";
    observation.goalIndex = 0;
    observation.direction = parameters.directions[0];
    observation.formationProgress = 0;
    observation.crossingCount = 0;
    observation.attempt = 0;
    observation.missCount = 0;
    particleFrame.sectionPresence = 0;
    observation.wake = undefined;
    observation.objects = undefined;
  }

  function placeGoal(): boolean {
    const course = parameters.course;
    const direction = parameters.directions[observation.goalIndex];
    if (!direction)
      throw new Error("Start goal index is outside its lesson sequence");
    origin.copy(viewpoint.worldPosition);
    goalUp.copy(viewpoint.worldUp);
    initialHeading.setFromRotationMatrix(
      headingMatrix.lookAt(ORIGIN, viewpoint.worldDirection, goalUp),
    );
    goalNormal.copy(viewpoint.worldDirection).negate();
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
    const horizontal = direction === "right" || direction === "left";
    const displacement = Math.min(
      sample(
        horizontal
          ? course.horizontalOffsetMeters
          : course.verticalOffsetMeters,
      ),
      Math.max(0, distance * Math.tan(halfAngle) - radius * 1.6),
    );
    courseOffset.set(
      horizontal ? displacement * (direction === "right" ? 1 : -1) : 0,
      horizontal ? 0 : displacement * (direction === "up" ? 1 : -1),
      -distance,
    );
    targetPosition
      .copy(courseOffset)
      .applyQuaternion(initialHeading)
      .add(origin);
    if (options.maximumGoalYAt)
      targetPosition.y = Math.min(
        targetPosition.y,
        options.maximumGoalYAt(targetPosition.x, targetPosition.z),
      );
    targetOffset.copy(targetPosition).sub(origin);
    const depth = targetOffset.dot(viewpoint.worldDirection);
    const lateral = Math.sqrt(
      Math.max(0, targetOffset.lengthSq() - depth * depth),
    );
    // At the flight ceiling there may be no reachable ring in an upward view.
    // Wait for a feasible gaze instead of revealing a target outside the view.
    if (
      depth <= 0 ||
      lateral + radius * 1.6 > depth * Math.tan(viewpoint.viewHalfAngleRadians)
    )
      return false;
    goalPosition.copy(targetPosition);
    // Capture the actual eye direction once. Placed particles never follow the head.
    arrowPosition
      .copy(origin)
      .addScaledVector(viewpoint.worldDirection, distance * 0.55);
    observation.direction = direction;
    particleFrame.arrowAngleRadians =
      direction === "right"
        ? 0
        : direction === "left"
          ? Math.PI
          : direction === "up"
            ? Math.PI / 2
            : -Math.PI / 2;
    particleFrame.ringRadiusMeters = radius;
    particleFrame.previews = previews;
    previewStartedSeconds = particleFrame.elapsedSeconds;
    curveOffset.copy(targetPosition).sub(origin);
    forward.copy(goalNormal).multiplyScalar(-distance);
    for (const [index, preview] of previews.entries()) {
      const t = 0.45 + index * 0.16;
      const smooth = t * t * (3 - 2 * t);
      preview.goalPosition
        .copy(origin)
        .addScaledVector(curveOffset, smooth)
        .addScaledVector(forward, t * (1 - t) * (1 - 2 * t));
      preview.goalNormal
        .copy(curveOffset)
        .multiplyScalar(6 * t * (1 - t))
        .addScaledVector(forward, 1 - 6 * t + 6 * t * t)
        .normalize()
        .negate();
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

  function sample([minimum, maximum]: DistanceRange): number {
    return minimum + (maximum - minimum) * random();
  }

  function update(deltaSeconds: number): void {
    if (!loaded || !active) return;
    if (!initialized) {
      previousPosition.copy(viewpoint.worldPosition);
      placeGoal();
      initialized = true;
    }
    const elapsed =
      playing && Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    particleFrame.elapsedSeconds += elapsed;
    phaseSeconds += elapsed;
    if (observation.wake) wake.ageSeconds += elapsed;

    if (observation.phase === "arrival") {
      const progress = Math.min(1, phaseSeconds / parameters.arrivalSeconds);
      if (playing && progress === 1 && formationAllowed && placeGoal()) {
        particleFrame.sectionPresence = 1;
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
        phaseSeconds = 0;
      }
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
      observation.phase = "missed";
      dissolutionFormation = observation.formationProgress;
      observation.missCount += 1;
      observation.wake = undefined;
      phaseSeconds = 0;
    }
    previousPosition.copy(viewpoint.worldPosition);
    if (!particles) return;
    particleFrame.previewElapsedSeconds =
      particleFrame.elapsedSeconds - previewStartedSeconds;
    particleFrame.formationProgress = observation.formationProgress;
    particleFrame.wake = observation.wake;
    particles?.update(particleFrame);
    observation.objects = particles.readObjectAnchors();
  }
}
