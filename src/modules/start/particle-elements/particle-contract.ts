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
  readonly showArrows?: boolean;
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
  /** Clear opening after subtracting the dense particle core; absent for arrows. */
  readonly openingRadiusMeters?: number;
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
  readonly grainsPerSample: number;
  readonly grainSpreadMeters: number;
  readonly accentFraction: number;
  readonly haloOpacity: ParticleRange;
  readonly seed: number;
}

// 4. Directional feedback: independent timing, passage detection and rendering
export interface ParticleLightSettings {
  readonly capacity: number;
  readonly periodSeconds: number;
  readonly sweepSeconds: number;
  readonly staggerSeconds: number;
  readonly guideStrength: number;
  readonly lightGain: number;
  readonly lightSizeBoost: number;
  readonly glintStrength: number;
  readonly flashSeconds: number;
  readonly bandWidth: number;
  readonly glassFraction: number;
  readonly color: number;
}
export interface ParticleLightFrame {
  head: number;
  strength: number;
}
export interface ParticleLight {
  readonly reset: (count: number) => void;
  /** Trigger once for a displayed element index; does not change exercise success. */
  readonly pass: (index: number) => void;
  /** Borrowed per-element frames, valid until the next update or reset. */
  readonly update: (seconds: number) => readonly ParticleLightFrame[];
}
export interface RingTarget {
  readonly elementIndex: number;
  readonly center: Readonly<Vector3>;
  readonly direction: Readonly<Vector3>;
  readonly radiusMeters: number;
}
export interface RingPassage {
  /** Owns a snapshot; reset clears passage history and seeds the movement segment. */
  readonly reset: (
    rings: readonly RingTarget[],
    player: Readonly<Vector3>,
  ) => void;
  /** Borrowed indices of newly crossed openings, in forward flight only. */
  readonly update: (player: Readonly<Vector3>) => readonly number[];
}

// 5. Retirement is requested by the section and permitted only behind actual flight.
export interface ElementBounds {
  readonly center: Readonly<Vector3>;
  readonly radius: number;
}
export interface RetirementSettings {
  readonly capacity: number;
  readonly dissolveSeconds: number;
  readonly clearanceMeters: number;
}
export interface ElementRetirement {
  /** Stable GPU uniform storage; values are opacity multipliers in [0, 1]. */
  readonly presence: Float32Array;
  readonly reset: (bounds: readonly ElementBounds[]) => void;
  readonly request: () => void;
  readonly update: (
    seconds: number,
    flight: {
      readonly position: Readonly<Vector3>;
      readonly direction: Readonly<Vector3>;
    },
  ) => void;
  readonly isFinished: () => boolean;
}
