import type { Color, PerspectiveCamera, WebGLRenderer } from "three";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type {
  NarrationSchedule,
  ShowLevelName,
} from "../dramaturgy/narration-schedule";
import type { ShowClock, ShowTimeSample } from "../dramaturgy/show-clock";
import type { ShowLevelState, ShowSense } from "../dramaturgy/show-levels";
import type { StartObservation } from "../modules/start/start-contract";
import type { DroneOrgan } from "../sound/drone-organ/organ-frame";
import type {
  AudioTimebase,
  NarrationPlayer,
  NarrationRecording,
} from "../sound/playback";
import type { WorldModule } from "../world/module-runtime";

interface PresentationFade {
  readonly setBackground: (background: Color) => void;
  readonly setPresence: (presence: number) => void;
}

export interface ShowRequest {
  readonly schedule: NarrationSchedule;
  readonly language: NarrationLanguage;
  readonly states: Record<ShowLevelName, ShowLevelState>;
}

export interface TutorialStatus {
  /** Borrowed world-space passage target; absent during preparation. */
  readonly goalTarget?: Readonly<{ x: number; y: number; z: number }>;
  readonly phase: string;
  readonly goalIndex: number;
  readonly direction: "right" | "left" | "up" | "down";
  readonly crossingCount: number;
}

export interface RunningShow {
  readonly readTutorial: () => TutorialStatus | undefined;
  /** Continuous visit timeline; main cues remain relative to mainStartSeconds. */
  readonly sample: () => ShowTimeSample & { readonly mainStartSeconds: number };
  readonly play: ShowClock["play"];
  readonly pause: ShowClock["pause"];
  readonly seekTo: ShowClock["seekTo"];
  readonly seekBy: ShowClock["seekBy"];
  readonly setTimeScale: ShowClock["setTimeScale"];
  /** Toggle from the current Show state, independently of UI refresh timing. */
  readonly togglePlayback: () => void;
  /** Rewind and hold; the current world and flight remain unchanged. */
  readonly resetTime: () => void;
  readonly readLanguage: () => NarrationLanguage;
  readonly readActiveLevel: () => ShowLevelName;
  /** Replace narration at the current position without changing playback state. */
  readonly setLanguage: (language: NarrationLanguage) => void;
  readonly readAudioState: () => AudioContextState;
}

export interface ShowWorld {
  readonly camera: Pick<
    PerspectiveCamera,
    "far" | "updateProjectionMatrix" | "matrixWorld"
  >;
  readonly renderer: Pick<WebGLRenderer, "setClearColor">;
  readonly modules: {
    readonly activate: (module: WorldModule) => void;
    readonly deactivate: (module: WorldModule) => void;
  };
  readonly viewpoint: {
    readonly worldPosition: Readonly<{ x: number; y: number; z: number }>;
  };
}

type SenseDrivers = Readonly<
  Partial<Record<ShowSense, (intensity: number) => void>>
>;

/** Narrow reach from show policy into the world composed by Level Runtime. */
export interface ShowWorldReach {
  readonly gates: ReadonlyMap<ShowSense, readonly WorldModule[]>;
  readonly senses: SenseDrivers;
  readonly worldFades: {
    readonly structure?: PresentationFade;
    readonly animals?: PresentationFade;
  };
  readonly setSkyBackground?: (background: Color) => void;
  /**
   * Fades the closing credits in at the end of the show. Not a gate: the
   * credits are not a sense, and the panel costs no draw while hidden.
   */
  readonly setEndCreditsPresence?: (presence: number) => void;
  /** Places the authored animal crossings; composed only for a show. */
  readonly followPassages?: (showTimeSeconds: number) => void;

  /**
   * Where the moving actor clouds are, so the drone organ can put its two
   * placed voices on the birds and the insects the motion sense shows.
   */
  readonly readMotionActorCenters?: (group: "birds" | "flies") => Float32Array;
}

export interface ShowTutorial {
  readonly setRoomPresence?: (presence: number) => void;
  readonly start: {
    readonly readObservation: () => StartObservation;
    readonly setPlaying: (playing: boolean) => void;
    readonly setFormationAllowed: (allowed: boolean) => void;
    readonly setGoalAdvanceAllowed: (allowed: boolean) => void;
  };
  /** Run resets practice once; Show resets playback policy. */
  readonly reset: () => void;
  readonly parameters: {
    readonly maximumPracticeSeconds: number;
    readonly directions: readonly [
      StartObservation["direction"],
      ...StartObservation["direction"][],
    ];
    readonly formationSeconds: number;
    readonly windStrength?: number;
  };
  readonly recordings?: Readonly<
    Record<NarrationLanguage, readonly NarrationRecording[]>
  >;
  /** Run removes training resources and releases the prepared main world. */
  readonly finish: () => void;
}

export interface ShowRuntime {
  readonly setTutorial: (tutorial: ShowTutorial) => void;
  readonly readSpeechActive: () => boolean;
  /** Run holds playback until an exclusive training sample is prepared. */
  readonly setPreparationState: (state: "loading" | "ready" | "failed") => void;
  readonly update: () => void;
  readonly readActiveLevelState: () => ShowLevelState;
  readonly running: RunningShow;
  readonly unload: () => Promise<void>;
}

export interface ShowRuntimeOptions {
  readonly world: ShowWorld;
  readonly reach: ShowWorldReach;
  readonly worldSurface: {
    readonly groundYAt: (x: number, z: number) => number;
  };
  readonly timebase: AudioTimebase;
  readonly createNarration: () => NarrationPlayer;
  readonly droneOrgan?: DroneOrgan;
  readonly standalone?: boolean;
  readonly tutorial?: ShowTutorial;
}
