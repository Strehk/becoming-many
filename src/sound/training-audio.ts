type TrainingObject = "ringLeft" | "ringRight" | "arrow";
type Position = Readonly<{ x: number; y: number; z: number }>;

interface GrainRecipe {
  readonly sampleId: string;
  readonly grainSizeSeconds: number;
  readonly overlapSeconds: number;
  readonly playbackRate: number;
  readonly volumeDb: number;
  readonly detuneCents: number;
  readonly offsetSeconds?: number;
}

interface EffectRecipe {
  readonly url: string;
  readonly volumeDb: number;
}

export interface TrainingAudioParameters {
  readonly effects?: {
    readonly wind: EffectRecipe;
    readonly passage: EffectRecipe;
  };
  readonly samples: readonly Readonly<{ id: string; url: string }>[];
  readonly layers: readonly [
    GrainRecipe & { readonly object: TrainingObject },
    GrainRecipe & { readonly object: TrainingObject },
    GrainRecipe & { readonly object: TrainingObject },
  ];
  readonly goal: GrainRecipe;
  readonly referenceDistanceMeters: number;
  readonly maximumDistanceMeters: number;
  readonly rolloffFactor: number;
  readonly room: {
    readonly decaySeconds: number;
    readonly preDelaySeconds: number;
    readonly sendGain: number;
    readonly dryGain: number;
    readonly nearCutoffHz: number;
    readonly farCutoffHz: number;
    readonly farDistanceMeters: number;
    readonly speechGain: number;
  };
}

/** Borrowed visual/speech facts; sound never decides learning or transport. */
export interface TrainingAudioFrame {
  readonly goalIndex: number;
  readonly attempt: number;
  readonly phase:
    | "arrival"
    | "turning"
    | "forming"
    | "flying"
    | "crossed"
    | "missed"
    | "complete";
  readonly goalPosition: Position;
  readonly objects?: Readonly<Record<TrainingObject, Position>>;
  readonly formationProgress: number;
  readonly arrowFormationProgress?: number;
  /** Monotonic actual crossings, including first passages through guide rings. */
  readonly passageCount?: number;
  readonly passagePosition?: Position;
}

export interface TrainingAudio {
  readonly update: (
    frame: TrainingAudioFrame,
    isPlaying: boolean,
    speechActive?: boolean,
  ) => void;
  /** Reset the retained practice reveal and passage baseline before the next frame. */
  readonly reset: () => void;
  /** Retire sources at their last world positions and drain the shared hall. */
  readonly beginRelease: () => void;
  /** Called by the existing frame owner; true means the bounded tail has ended. */
  readonly updateRelease: (isPlaying: boolean) => boolean;
  readonly unload: () => void;
}
