import type { Vector3 } from "three";
import type {
  ParticleRange,
  PathParticleParameters,
} from "./flight-path/particle-contract";

// 1. Authored exercise data
export interface RouteParameters {
  readonly leadMeters: number;
  readonly straightMeters: number;
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
}

// 2. World placement and movement observations
/** Immutable for the visible lifetime; position is actual rig height, not the visual offset. */
export interface ExercisePose {
  readonly position: Readonly<Vector3>;
  readonly yawRadians: number;
}
export type ExerciseOutcome = "pending" | "passed" | "missed";

// 3. Engine input and output
export interface ExerciseFrame {
  readonly deltaSeconds: number;
  readonly progress: ExerciseOutcome;
  readonly instructionReleased: boolean;
  readonly instructionEnded: boolean;
}
export interface ExerciseState {
  phase: "instruction" | "flying" | "retiring" | "complete";
  exerciseIndex: number;
  attempt: number;
  elapsedSeconds: number;
  outcome: ExerciseOutcome;
}
export type ExerciseAction = "show" | "retire" | undefined;
