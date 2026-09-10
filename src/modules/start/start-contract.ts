import type { Vector3 } from "three";
import type {
  FlightRoute,
  ParticleRange,
  PathParticleParameters,
} from "./flight-path/particle-contract";

// 1. Authored exercise data
export interface RouteParameters {
  readonly leadMeters: number;
  readonly straightMeters: number;
  readonly outroMeters: number;
  readonly turnRadiusMeters: ParticleRange;
  readonly turnRadians: ParticleRange;
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
  readonly route: RouteParameters;
  readonly particles: PathParticleParameters;
  readonly progress: ProgressParameters;
  readonly deviation: DeviationParameters;
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
export interface DeviationParameters {
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
  phase: "instruction" | "flying" | "outro" | "recovering";
  exerciseIndex: number;
  attempt: number;
  elapsedSeconds: number;
}
export type ExerciseAction =
  | "show"
  | "prepare-next"
  | "advance"
  | "recover"
  | undefined;
