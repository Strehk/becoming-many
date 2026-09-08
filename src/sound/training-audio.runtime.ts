import type { SpatialAudio, SpatialSource } from "./spatial-audio.runtime";

export interface TrainingAudioParameters {
  readonly sampleUrl: string;
  readonly grainSizeSeconds: number;
  readonly overlapSeconds: number;
  readonly playbackRate: number;
  readonly objectVolumeDb: number;
  readonly ambientVolumeDb: number;
  readonly referenceDistanceMeters: number;
  readonly maximumDistanceMeters: number;
  readonly rolloffFactor: number;
}

/** Borrowed observations; sound neither retains them nor decides goal success. */
export interface TrainingAudioFrame {
  readonly phase: "arrival" | "forming" | "flying" | "crossed" | "complete";
  readonly goalPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly formationProgress: number;
  readonly wake?: { readonly strength: number };
}

export interface TrainingAudio {
  readonly update: (frame: TrainingAudioFrame, isPlaying: boolean) => void;
  /** Stops scheduling, disconnects voices and releases exclusive sample references. */
  readonly unload: () => void;
}

const LEVEL_RAMP_SECONDS = 0.08;
const CROSSING_DETUNE_CENTS = 500;
// Tone 14 retains native grains through its stop timeout and lookahead tail.
// At 80 ms minimum, the maximum playback rate schedules at most 25 grains/s.
const MINIMUM_GRAIN_SECONDS = 0.08;
const MAXIMUM_GRAIN_SECONDS = 0.5;
const MINIMUM_PLAYBACK_RATE = 0.25;
const MAXIMUM_PLAYBACK_RATE = 2;

/**
 * One shared sample, one spatial granular goal voice and one quiet ordinary
 * sample bed. Limits bound grain scheduling; omitted audio creates nothing.
 * Run owns this follower and supplies the same facts used by training graphics.
 */
export async function createTrainingAudio(
  parameters: TrainingAudioParameters,
  audio: SpatialAudio,
  signal: AbortSignal,
): Promise<TrainingAudio> {
  validateTrainingAudioParameters(parameters);
  const response = await fetch(parameters.sampleUrl, { signal });
  if (!response.ok)
    throw new Error(`Training sample failed: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  const sample = await audio.context.decodeAudioData(bytes);
  signal.throwIfAborted();
  const { GrainPlayer, Player } = await import("tone");
  signal.throwIfAborted();
  const input = audio.context.createGain();
  let goal: InstanceType<typeof GrainPlayer> | undefined;
  let ambient: InstanceType<typeof Player> | undefined;
  let placement: SpatialSource | undefined;
  let isUnloaded = false;

  function unload(): void {
    if (isUnloaded) return;
    isUnloaded = true;
    // Disconnect the borrowed source route before disposing its producing nodes.
    const errors: unknown[] = [];
    for (const release of [
      () => placement?.unload(),
      () => goal?.dispose(),
      () => ambient?.dispose(),
      () => input.disconnect(),
    ]) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Training audio cleanup failed");
  }

  try {
    placement = audio.createSource(input as GainNode, parameters);
    goal = new GrainPlayer({
      context: audio.context,
      url: sample,
      loop: true,
      grainSize: parameters.grainSizeSeconds,
      overlap: parameters.overlapSeconds,
      playbackRate: parameters.playbackRate,
      volume: parameters.objectVolumeDb,
    });
    goal.connect(input);
    ambient = new Player({
      context: audio.context,
      url: sample,
      loop: true,
      fadeIn: LEVEL_RAMP_SECONDS,
      fadeOut: LEVEL_RAMP_SECONDS,
      playbackRate: parameters.playbackRate,
      volume: parameters.ambientVolumeDb,
    });
    ambient.toDestination();
    const goalVoice = goal;
    const ambientVoice = ambient;
    const goalPlacement = placement;
    let isGoalPlaying = false;
    let isAmbientPlaying = false;
    let writtenStrength = -1;

    return {
      update(frame, isPlaying): void {
        if (isUnloaded) return;
        const audible = isPlaying && audio.context.state === "running";
        const hasGoal = frame.phase !== "arrival" && frame.phase !== "complete";
        const playGoal = audible && hasGoal && frame.formationProgress > 0;
        const playAmbient = audible && frame.phase !== "complete";
        const atSeconds = audio.context.now();
        if (playGoal !== isGoalPlaying) {
          isGoalPlaying = playGoal;
          if (playGoal) goalVoice.start(atSeconds);
          else goalVoice.stop(atSeconds);
        }
        if (playAmbient !== isAmbientPlaying) {
          isAmbientPlaying = playAmbient;
          if (playAmbient) ambientVoice.start(atSeconds);
          else ambientVoice.stop(atSeconds);
        }
        const strength = playGoal ? frame.formationProgress : 0;
        if (strength !== writtenStrength) {
          input.gain.cancelScheduledValues(audio.context.immediate());
          input.gain.setTargetAtTime(
            strength,
            audio.context.immediate(),
            LEVEL_RAMP_SECONDS,
          );
          writtenStrength = strength;
        }
        if (!playGoal) return;
        const position = frame.goalPosition;
        goalPlacement.setPosition(position.x, position.y, position.z);
        // The same visual wake briefly raises the single goal voice; no extra
        // crossing oscillator, timer or feedback schedule survives the event.
        goalVoice.detune = (frame.wake?.strength ?? 0) * CROSSING_DETUNE_CENTS;
      },
      unload,
    };
  } catch (error) {
    try {
      unload();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Training audio startup failed",
      );
    }
    throw error;
  }
}

/** Reject unbounded grain recipes before fetching or creating audio nodes. */
export function validateTrainingAudioParameters(
  parameters: TrainingAudioParameters,
): void {
  if (
    !parameters.sampleUrl ||
    !Number.isFinite(parameters.grainSizeSeconds) ||
    parameters.grainSizeSeconds < MINIMUM_GRAIN_SECONDS ||
    parameters.grainSizeSeconds > MAXIMUM_GRAIN_SECONDS ||
    !Number.isFinite(parameters.overlapSeconds) ||
    parameters.overlapSeconds < 0 ||
    parameters.overlapSeconds > parameters.grainSizeSeconds ||
    !Number.isFinite(parameters.playbackRate) ||
    parameters.playbackRate < MINIMUM_PLAYBACK_RATE ||
    parameters.playbackRate > MAXIMUM_PLAYBACK_RATE ||
    !Number.isFinite(parameters.objectVolumeDb) ||
    !Number.isFinite(parameters.ambientVolumeDb) ||
    !Number.isFinite(parameters.referenceDistanceMeters) ||
    parameters.referenceDistanceMeters <= 0 ||
    !Number.isFinite(parameters.maximumDistanceMeters) ||
    parameters.maximumDistanceMeters < parameters.referenceDistanceMeters ||
    !Number.isFinite(parameters.rolloffFactor) ||
    parameters.rolloffFactor < 0
  )
    throw new Error("Invalid or unbounded training audio parameters");
}
