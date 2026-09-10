import type { BufferGeometry, Vector3 } from "three";
import type {
  FlightRoute,
  ParticleRange,
} from "../flight-path/particle-contract";

// 1. Shape and procedural placement: borrowed samples, measured in meters
export interface ElementPlacement {
  readonly kind: "ring" | "arrow";
  readonly routeDistanceMeters: number;
  readonly position: Vector3;
  readonly direction: Vector3;
}
export interface ElementSettings {
  readonly spacingMeters: number;
  readonly firstMeters: number;
  readonly ringRadiusMeters: number;
  readonly arrowLengthMeters: number;
  readonly arrowOffsetMeters: number;
  readonly arrowPhaseFraction: number;
}
export interface ElementSource {
  readonly placement: ElementPlacement;
  readonly shape: FlightRoute;
}

// 2. Shared animation and simulation contracts; neither knows the shape
export interface AnimationSettings {
  readonly revealSeconds: number;
  readonly dissolveSeconds: number;
  readonly scatterMeters: number;
}
export interface ParticleAnimation {
  readonly reset: () => void;
  readonly reveal: () => void;
  readonly dissolve: () => void;
  readonly update: (seconds: number) => number;
  readonly isFinished: () => boolean;
}
export interface SimulationSettings {
  readonly radiusMeters: number;
  readonly impulse: number;
  readonly spring: number;
  readonly damping: number;
  readonly maximumStepMeters: number;
  readonly maximumOffsetMeters: number;
  readonly maximumDeltaSeconds: number;
}
export interface ParticleSimulation {
  /** Reset borrows stable world-space targets until the next reset; owns offsets. */
  readonly reset: (targets: Float32Array) => void;
  /** Borrowed offsets, valid until the next update. Looking around is not movement. */
  readonly update: (seconds: number, player: Readonly<Vector3>) => Float32Array;
}
/** Returns owned compatible particle attributes; the display disposes each result. */
export type ElementGeometryFactory = (shape: FlightRoute) => BufferGeometry;

// 3. Shape-independent volume appearance, sampled once during generation
export interface VolumeSettings {
  readonly coreRadiusMeters: number;
  readonly haloRadiusMeters: number;
  readonly haloFraction: number;
  readonly coreOpacity: number;
  readonly coreSizeScale: number;
  readonly haloSizeScale: number;
  readonly relief: number;
  readonly haloOpacity: ParticleRange;
  readonly seed: number;
}
