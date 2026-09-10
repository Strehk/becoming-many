import type { Vector3 } from "three";
import type {
  FlightRoute,
  ParticleRange,
  PathParticleParameters,
} from "./flight-path/particle-contract";
import type { ElementSettings } from "./particle-elements/particle-contract";

// 1. Authored exercise data
export interface RouteParameters {
  /** Vertical bends climb/descend and return to a level tangent. */
  readonly turnPlane?: "horizontal" | "vertical";
  readonly leadMeters: number;
  readonly straightMeters: number;
  readonly outroMeters: number;
  readonly turnRadiusMeters: ParticleRange;
  /** Total heading change in degrees; equal endpoints disable variation. */
  readonly turnDegrees: ParticleRange;
  readonly turnSign: -1 | 1;
}
export interface ProgressParameters {
  readonly checkpointSpacingMeters: number;
  readonly toleranceMeters: number;
  readonly extraTravelMeters: number;
  readonly maximumStepMeters: number;
}
export interface ExerciseDefinition {
  readonly id: string;
  readonly voice: ExerciseVoiceCue;
  readonly sequence: StartSequence;
  readonly route: RouteParameters;
  readonly particles: PathParticleParameters;
  readonly progress: ProgressParameters;
  readonly deviation: DeviationParameters;
  readonly elements: ElementSettings;
}

/** Recording-local visual cues. Omitted worldReveal retains the already visible world. */
export interface StartSequence {
  readonly approachMeters: number;
  /** Optional early centerline reveal; rings still wait for the spoken instruction. */
  readonly pathAtSeconds?: number;
  readonly worldReveal?: {
    readonly atSeconds: number;
    readonly fadeSeconds: number;
  };
}

/** Recording-local seconds; cue markers come from approximate word alignment. */
export interface ExerciseVoiceCue {
  readonly url: string;
  readonly durationSeconds: number;
  readonly instructionAtSeconds: number;
}

/** Injected playback capability. Sound owns media and cleanup; Start owns lesson selection.
 * Offsets are native media seconds. Failure must never count as natural completion.
 */
export interface StartVoice {
  readonly play: (cue: ExerciseVoiceCue, offsetSeconds: number) => void;
  readonly read: () => {
    readonly offsetSeconds: number;
    readonly ended: boolean;
    readonly failed: boolean;
  };
  readonly stop: () => void;
}

// 2. World placement and movement observations
/** Immutable for the visible lifetime; position is actual rig height, not the visual offset. */
export interface ExercisePose {
  readonly position: Readonly<Vector3>;
  readonly yawRadians: number;
}
export type ExerciseOutcome = "pending" | "passed" | "missed";

// 3. Section geometry and independent deviation observations
export interface ExerciseRoute extends FlightRoute {
  readonly exerciseStartMeters: number;
  readonly exerciseEndMeters: number;
  readonly sampleDirection: (distanceMeters: number, target: Vector3) => void;
}
export interface PlacedRoute {
  readonly route: ExerciseRoute;
  readonly pose: ExercisePose;
}
/** Actual travel and camera facts; looking away alone cannot request recovery. */
export interface RecoveryView {
  readonly worldPosition: Readonly<Vector3>;
  readonly worldDirection: Readonly<Vector3>;
  readonly worldFlightDirection?: Readonly<Vector3>;
  readonly viewHalfAngleRadians: number;
  readonly viewDistanceMeters: number;
}
export interface DeviationParameters {
  readonly directionDifferenceRadians: number;
  readonly lookAheadMeters: number;
  readonly visibilityPaddingMeters: number;
  readonly distanceMeters: number;
  readonly outsideTravelMeters: number;
  readonly maximumStepMeters: number;
}

// 4. Engine input and output
export interface ExerciseFrame {
  readonly deltaSeconds: number;
  readonly progress: ExerciseOutcome;
  readonly reachedEnd: boolean;
  readonly deviated: boolean;
  readonly prepared: boolean;
  readonly instructionReleased: boolean;
  readonly instructionEnded: boolean;
}
export interface ExerciseState {
  phase:
    | "instruction"
    | "flying"
    | "outro"
    | "recovering"
    | "closing"
    | "complete";
  exerciseIndex: number;
  attempt: number;
  elapsedSeconds: number;
}
export type ExerciseAction =
  | "complete"
  | "finish"
  | "show"
  | "prepare-next"
  | "advance"
  | "recover"
  | undefined;
