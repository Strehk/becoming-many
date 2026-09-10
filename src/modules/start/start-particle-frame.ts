import type { Vector3 } from "three";

/** One crossing impulse; direction is world-space unit length, age is playing seconds. */
export interface StartParticleWake {
  readonly direction: Readonly<Vector3>;
  readonly ageSeconds: number;
}

/** Borrowed during update; vectors use world coordinates and must not be mutated. */
export interface StartArrowFrame {
  readonly position: Readonly<Vector3>;
  readonly normal: Readonly<Vector3>;
  readonly up: Readonly<Vector3>;
  readonly presence: number;
  readonly formation: number;
}

/** Current presentation facts; the effect copies inputs and never changes learning. */
export interface StartParticleFrame {
  readonly elapsedSeconds: number;
  readonly previewElapsedSeconds: number;
  readonly goalPosition: Readonly<Vector3>;
  readonly goalNormal: Readonly<Vector3>;
  readonly goalUp: Readonly<Vector3>;
  readonly ringRadiusMeters: number;
  readonly formationProgress: number;
  readonly ringPresence: number;
  readonly arrow: StartArrowFrame;
  readonly retiringArrow: StartArrowFrame;
  readonly wake?: StartParticleWake;
  readonly previews: readonly StartParticlePreview[];
}

export interface StartParticlePreview {
  readonly goalUp: Readonly<Vector3>;
  /** First swept passage, supplied by Start; undefined means not crossed. */
  readonly crossingAgeSeconds?: number;
  readonly goalPosition: Readonly<Vector3>;
  readonly goalNormal: Readonly<Vector3>;
  readonly ringRadiusMeters: number;
}

/** Borrowed world-space centers of the visible particle bodies, not listener offsets. */
export interface StartParticleObjects {
  readonly ringLeft: Readonly<Vector3>;
  readonly ringRight: Readonly<Vector3>;
  readonly arrow: Readonly<Vector3>;
}
