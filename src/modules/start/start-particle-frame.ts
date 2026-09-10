import type { Vector3 } from "three";

/** Borrowed world-space cue pose and lifetime; only Arrows and its orchestrator may mutate it. */
export interface StartArrowFrame {
  readonly position: Readonly<Vector3>;
  readonly normal: Readonly<Vector3>;
  readonly up: Readonly<Vector3>;
  readonly presence: number;
  readonly formation: number;
}

/** One crossing impulse; direction is world-space unit length, age is playing seconds. */
export interface StartParticleWake {
  readonly direction: Readonly<Vector3>;
  readonly ageSeconds: number;
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

export interface StartParticleEffect {
  readonly load: () => void;
  readonly setVisible: (visible: boolean) => void;
  /** Externally supplied time only; invisible/unloaded effects perform no work. */
  readonly update: (frame: StartParticleFrame) => void;
  /** Borrowed until the next update; callers must neither mutate nor retain vectors. */
  readonly readObjectAnchors: () => StartParticleObjects | undefined;
  readonly unload: () => void;
}
