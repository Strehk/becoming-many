import type { Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { StartParticleObjects } from "./start-particle-frame";
import type { StartDirection } from "./start-settings";

export type StartPhase =
  | "arrival"
  | "turning"
  | "forming"
  | "flying"
  | "crossed"
  | "missed"
  | "complete";

/** Borrowed until the next World frame; consumers neither retain nor mutate vectors. */
export interface StartObservation {
  readonly phase: StartPhase;
  readonly goalIndex: number;
  readonly direction: StartDirection;
  /** Cue entrance while turning; final ring center after formation. */
  readonly goalPosition: Readonly<Vector3>;
  readonly crossingCount: number;
  readonly passageCount: number;
  readonly passagePosition: Readonly<Vector3>;
  readonly attempt: number;
  readonly objects: StartParticleObjects | undefined;
  readonly formationProgress: number;
  readonly arrowFormationProgress: number;
}

/** Start owns learning and resources; integration supplies playback and narration gates. */
export interface StartModuleHandle {
  readonly readObservation: () => StartObservation;
  readonly setPlaying: (playing: boolean) => void;
  readonly setFormationAllowed: (allowed: boolean) => void;
  readonly setGoalAdvanceAllowed: (allowed: boolean) => void;
  readonly resetPractice: () => void;
  readonly module: WorldModule;
}
