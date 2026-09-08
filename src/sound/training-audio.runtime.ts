import type { SpatialAudio, SpatialSource } from "./spatial-audio.runtime";

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

export interface TrainingAudioParameters {
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
  readonly phase: "arrival" | "forming" | "flying" | "crossed" | "complete";
  readonly goalPosition: Position;
  readonly objects?: Readonly<Record<TrainingObject, Position>>;
  readonly formationProgress: number;
  readonly wake?: { readonly strength: number };
}

export interface TrainingAudio {
  readonly update: (
    frame: TrainingAudioFrame,
    isPlaying: boolean,
    speechActive?: boolean,
  ) => void;
  readonly unload: () => void;
}

const LEVEL_RAMP_SECONDS = 0.08;
const CROSSING_DETUNE_CENTS = 500;
const MAXIMUM_SAMPLE_BYTES = 2_000_000;
const MAXIMUM_SAMPLE_SECONDS = 20;
// decodeAudioData resamples source files to the device context rate.
const MAXIMUM_SAMPLE_RATE = 96_000;
const MAXIMUM_STARTS_PER_SECOND = 40;

/**
 * Four fixed object voices share at most three short mono buffers and one hall.
 * Dry sound uses the shared spatial owner; diffuse sends apply the same inverse
 * distance attenuation before the hall. No new nodes or buffers are made per frame.
 */
export async function createTrainingAudio(
  parameters: TrainingAudioParameters,
  audio: SpatialAudio,
  signal: AbortSignal,
): Promise<TrainingAudio> {
  validateTrainingAudioParameters(parameters);
  const samples = new Map<string, AudioBuffer>();
  for (const source of parameters.samples) {
    signal.throwIfAborted();
    const response = await fetch(source.url, { signal });
    if (!response.ok)
      throw new Error(`Training sample failed: HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > MAXIMUM_SAMPLE_BYTES)
      throw new Error("Training sample exceeds byte capacity");
    const bytes = await readSampleBytes(response);
    signal.throwIfAborted();
    if (bytes.byteLength > MAXIMUM_SAMPLE_BYTES)
      throw new Error("Training sample exceeds byte capacity");
    const sample = await audio.context.decodeAudioData(bytes);
    signal.throwIfAborted();
    if (
      sample.numberOfChannels !== 1 ||
      !inRange(sample.duration, 0.01, MAXIMUM_SAMPLE_SECONDS) ||
      !inRange(sample.sampleRate, 8_000, MAXIMUM_SAMPLE_RATE)
    )
      throw new Error("Training sample must be bounded mono audio");
    samples.set(source.id, sample);
  }
  const { GrainPlayer, Reverb, connect } = await import("tone");
  signal.throwIfAborted();
  const releases: (() => void)[] = [];
  let isUnloaded = false;
  function unload(): void {
    if (isUnloaded) return;
    isUnloaded = true;
    const errors: unknown[] = [];
    for (const release of releases.reverse()) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    releases.length = 0;
    samples.clear();
    if (errors.length)
      throw new AggregateError(errors, "Training audio cleanup failed");
  }
  try {
    const room = new Reverb({
      context: audio.context,
      decay: parameters.room.decaySeconds,
      preDelay: parameters.room.preDelaySeconds,
      wet: 1,
    });
    releases.push(() => room.dispose());
    // Tone publishes its IR after offline rendering. Await that publication before
    // abort cleanup, so no late generation writes into an already released owner.
    await room.ready;
    signal.throwIfAborted();
    const wetOutput = audio.context.createGain();
    releases.push(() => wetOutput.disconnect());
    wetOutput.gain.value = 0;
    room.connect(wetOutput);
    connect(wetOutput, audio.context.destination);
    const recipes = [...parameters.layers, parameters.goal];
    const voices = recipes.map((recipe, index) => {
      const sample = samples.get(recipe.sampleId);
      if (!sample || (recipe.offsetSeconds ?? 0) >= sample.duration)
        throw new Error("Training grain offset exceeds sample duration");
      const filter = audio.context.createBiquadFilter();
      releases.push(() => filter.disconnect());
      filter.type = "lowpass";
      filter.Q.value = 0.5;
      const direct = audio.context.createGain();
      releases.push(() => direct.disconnect());
      direct.gain.value = 0;
      const send = audio.context.createGain();
      releases.push(() => send.disconnect());
      send.gain.value = 0;
      filter.connect(direct);
      filter.connect(send);
      connect(send, room);
      const voice = new GrainPlayer({
        context: audio.context,
        url: sample,
        loop: true,
        grainSize: recipe.grainSizeSeconds,
        overlap: recipe.overlapSeconds,
        playbackRate: recipe.playbackRate,
        volume: recipe.volumeDb,
        detune: recipe.detuneCents,
      });
      releases.push(() => voice.dispose());
      voice.connect(filter);
      const placement: SpatialSource = audio.createSource(
        direct as GainNode,
        parameters,
      );
      releases.push(() => placement.unload());
      return {
        recipe,
        object: parameters.layers[index]?.object,
        voice,
        placement,
        filter,
        direct,
        send,
        playing: false,
        distance: -1,
        strength: -1,
      };
    });
    let previousAudible = false;
    let previousSpeech = false;
    return {
      update(frame, isPlaying, speechActive = false): void {
        if (isUnloaded) return;
        const audible =
          isPlaying &&
          audio.context.state === "running" &&
          frame.objects !== undefined &&
          frame.phase !== "complete";
        const speech = speechActive;
        const now = audio.context.immediate();
        const scheduled = audio.context.now();
        if (audible !== previousAudible || speech !== previousSpeech) {
          wetOutput.gain.cancelScheduledValues(now);
          if (!audible) wetOutput.gain.setValueAtTime(0, now);
          else
            wetOutput.gain.setTargetAtTime(
              speech ? parameters.room.speechGain : 1,
              now,
              LEVEL_RAMP_SECONDS,
            );
          previousAudible = audible;
          previousSpeech = speech;
        }
        for (let index = 0; index < voices.length; index++) {
          const entry = voices[index];
          if (!entry) continue;
          const isGoal = index === parameters.layers.length;
          const position = entry.object
            ? frame.objects?.[entry.object]
            : frame.goalPosition;
          if (position)
            entry.placement.setPosition(position.x, position.y, position.z);
          const strength =
            audible && (!isGoal || frame.phase !== "arrival")
              ? Math.max(0, Math.min(1, frame.formationProgress))
              : 0;
          const playing = strength > 0;
          if (playing !== entry.playing) {
            entry.playing = playing;
            if (playing)
              entry.voice.start(scheduled, entry.recipe.offsetSeconds ?? 0);
            else entry.voice.stop(scheduled);
          }
          const distance = entry.placement.readDistanceMeters();
          const level = strength * (speech ? parameters.room.speechGain : 1);
          if (
            Math.abs(distance - entry.distance) > 0.05 ||
            level !== entry.strength
          ) {
            const reference = parameters.referenceDistanceMeters;
            // Inverse-distance panners keep attenuating beyond maxDistance.
            // The diffuse send must follow that same unbounded distance curve.
            const clampedDistance = Math.max(reference, distance);
            const attenuation =
              reference /
              (reference +
                parameters.rolloffFactor * (clampedDistance - reference));
            const far = Math.max(
              0,
              Math.min(
                1,
                (distance - reference) /
                  (parameters.room.farDistanceMeters - reference),
              ),
            );
            entry.filter.frequency.setTargetAtTime(
              parameters.room.nearCutoffHz *
                (parameters.room.farCutoffHz / parameters.room.nearCutoffHz) **
                  far,
              now,
              LEVEL_RAMP_SECONDS,
            );
            entry.direct.gain.cancelScheduledValues(now);
            entry.send.gain.cancelScheduledValues(now);
            if (!playing) {
              entry.direct.gain.setValueAtTime(0, now);
              entry.send.gain.setValueAtTime(0, now);
            } else {
              entry.direct.gain.setTargetAtTime(
                level * parameters.room.dryGain * (1 - 0.5 * far),
                now,
                LEVEL_RAMP_SECONDS,
              );
              // Speech ducks the shared output once; per-source sends retain only
              // formation/distance so a hall tail also ducks immediately.
              entry.send.gain.setTargetAtTime(
                strength * parameters.room.sendGain * attenuation,
                now,
                LEVEL_RAMP_SECONDS,
              );
            }
            entry.distance = distance;
            entry.strength = level;
          }
          if (isGoal)
            entry.voice.detune =
              entry.recipe.detuneCents +
              (frame.wake?.strength ?? 0) * CROSSING_DETUNE_CENTS;
        }
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

/** Bound streamed downloads even when a server omits Content-Length. */
async function readSampleBytes(response: Response): Promise<ArrayBuffer> {
  if (!response.body) throw new Error("Training sample has no response body");
  const reader = response.body.getReader();
  const bytes = new Uint8Array(MAXIMUM_SAMPLE_BYTES);
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return bytes.buffer.slice(0, length);
      if (length + chunk.value.length > MAXIMUM_SAMPLE_BYTES) {
        await reader.cancel();
        throw new Error("Training sample exceeds byte capacity");
      }
      bytes.set(chunk.value, length);
      length += chunk.value.length;
    }
  } finally {
    reader.releaseLock();
  }
}

function inRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

/** Validate node, buffer and grain scheduling capacities before any allocation. */
export function validateTrainingAudioParameters(
  parameters: TrainingAudioParameters,
): void {
  const { samples, layers, goal, room } = parameters;
  const sampleIds = new Set(samples.map((sample) => sample.id));
  const recipes = [...layers, goal];
  const validRecipes = recipes.every(
    (recipe, index) =>
      sampleIds.has(recipe.sampleId) &&
      inRange(recipe.grainSizeSeconds, index < 3 ? 0.2 : 0.08, 0.5) &&
      inRange(recipe.overlapSeconds, 0, recipe.grainSizeSeconds) &&
      inRange(recipe.playbackRate, 0.25, index < 3 ? 1 : 2) &&
      inRange(recipe.volumeDb, -80, 0) &&
      inRange(recipe.detuneCents, -1200, 1200) &&
      inRange(recipe.offsetSeconds ?? 0, 0, MAXIMUM_SAMPLE_SECONDS),
  );
  if (
    samples.length < 1 ||
    samples.length > 3 ||
    sampleIds.size !== samples.length ||
    samples.some((sample) => !sample.id || !sample.url) ||
    layers.length !== 3 ||
    new Set(layers.map((layer) => layer.object)).size !== 3 ||
    layers.some(
      (layer) => !["ringLeft", "ringRight", "arrow"].includes(layer.object),
    ) ||
    !validRecipes ||
    recipes.reduce(
      (total, recipe) => total + recipe.playbackRate / recipe.grainSizeSeconds,
      0,
    ) > MAXIMUM_STARTS_PER_SECOND ||
    !inRange(parameters.referenceDistanceMeters, 0.1, 100) ||
    !inRange(
      parameters.maximumDistanceMeters,
      parameters.referenceDistanceMeters,
      1000,
    ) ||
    !inRange(parameters.rolloffFactor, 0.1, 4) ||
    !inRange(room.decaySeconds, 0.1, 12) ||
    !inRange(room.preDelaySeconds, 0, 0.1) ||
    !inRange(room.sendGain, 0, 1) ||
    !inRange(room.dryGain, 0, 1) ||
    !inRange(room.speechGain, 0, 1) ||
    !inRange(room.farCutoffHz, 80, 20000) ||
    !inRange(room.nearCutoffHz, room.farCutoffHz, 20000) ||
    !inRange(
      room.farDistanceMeters,
      parameters.referenceDistanceMeters + 0.1,
      parameters.maximumDistanceMeters,
    )
  )
    throw new Error("Invalid or unbounded training audio parameters");
}
