import { holdAudioParameter } from "./audio-parameter";
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

const LEVEL_RAMP_SECONDS = 0.18;
const SOURCE_RELEASE_SECONDS = 1.2;
const PAUSE_RELEASE_SECONDS = 0.08;
const SOURCE_RESTART_GAP_SECONDS = 0.001;
const HALL_RELEASE_SECONDS = 4;
const CROSSING_DETUNE_CENTS = 500;
const MAXIMUM_SAMPLE_BYTES = 2_000_000;
const MAXIMUM_SAMPLE_SECONDS = 20;
// decodeAudioData resamples source files to the device context rate.
const MAXIMUM_SAMPLE_RATE = 96_000;
const MAXIMUM_STARTS_PER_SECOND = 40;

/**
 * Four fixed object voices share at most three short mono buffers and one hall.
 * Optional wind and passage effects add two mono buffers and two pooled players.
 * Dry sound uses the shared spatial owner; diffuse sends apply the same inverse
 * distance attenuation before the hall. No new nodes or buffers are made per frame.
 */
export async function createTrainingAudio(
  parameters: TrainingAudioParameters,
  audio: SpatialAudio,
  signal: AbortSignal,
  random: () => number = Math.random,
): Promise<TrainingAudio> {
  validateTrainingAudioParameters(parameters);
  const samples = new Map<string, AudioBuffer>();
  async function loadSample(url: string): Promise<AudioBuffer> {
    signal.throwIfAborted();
    const response = await fetch(url, { signal });
    if (!response.ok)
      throw new Error(`Training sample failed: HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > MAXIMUM_SAMPLE_BYTES)
      throw new Error("Training sample exceeds byte capacity");
    const bytes = await readSampleBytes(response);
    signal.throwIfAborted();
    const sample = await audio.context.decodeAudioData(bytes);
    signal.throwIfAborted();
    if (
      sample.numberOfChannels !== 1 ||
      !inRange(sample.duration, 0.01, MAXIMUM_SAMPLE_SECONDS) ||
      !inRange(sample.sampleRate, 8_000, MAXIMUM_SAMPLE_RATE)
    )
      throw new Error("Training sample must be bounded mono audio");
    return sample;
  }
  for (const source of parameters.samples)
    samples.set(source.id, await loadSample(source.url));
  let effectSamples = parameters.effects
    ? {
        wind: await loadSample(parameters.effects.wind.url),
        passage: await loadSample(parameters.effects.passage.url),
      }
    : undefined;
  if (effectSamples && effectSamples.passage.duration > 2)
    throw new Error("Training passage sample must not exceed two seconds");
  const { GrainPlayer, Player, Reverb, connect } = await import("tone");
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
    effectSamples = undefined;
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
    const samplePool = [...samples.values()];
    releases.push(() => {
      samplePool.length = 0;
    });
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
        sampleIndex: samplePool.indexOf(sample),
        offsetSeconds: recipe.offsetSeconds ?? 0,
        playing: false,
        releaseAt: 0,
        pendingSelection: false,
        distance: -1,
        strength: -1,
      };
    });
    // Optional effects reuse this owner's context, hall and cleanup stack.
    const effects = createEffects();
    function createEffects() {
      if (!parameters.effects || !effectSamples) return undefined;
      const windGain = audio.context.createGain();
      releases.push(() => windGain.disconnect());
      windGain.gain.value = 0;
      connect(windGain, audio.context.destination);
      // Keep the shared hall gently fed through the earned closing narration.
      connect(windGain, room);
      const wind = new Player({
        context: audio.context,
        url: effectSamples.wind,
        loop: true,
        volume: parameters.effects.wind.volumeDb,
        fadeIn: 0.12,
        fadeOut: 0.15,
      });
      releases.push(() => wind.dispose());
      wind.connect(windGain);
      const direct = audio.context.createGain();
      releases.push(() => direct.disconnect());
      direct.gain.value = 0;
      const send = audio.context.createGain();
      releases.push(() => send.disconnect());
      send.gain.value = 0;
      connect(send, room);
      const passage = new Player({
        context: audio.context,
        url: effectSamples.passage,
        loop: false,
        volume: parameters.effects.passage.volumeDb,
        fadeIn: 0.005,
        fadeOut: 0.06,
      });
      releases.push(() => passage.dispose());
      passage.connect(direct);
      passage.connect(send);
      const placement = audio.createSource(direct as GainNode, parameters);
      releases.push(() => placement.unload());
      return {
        wind,
        windGain,
        direct,
        send,
        passage,
        placement,
        duration: effectSamples.wind.duration,
        windPlaying: false,
        windStartedAt: 0,
        windStoppedAt: 0,
        windOffset: 0,
        roomRevealed: false,
        previousPassageCount: -1,
        passagePlaying: false,
        passageAvailableAt: 0,
        passageDuration: effectSamples.passage.duration,
        previousLevel: -1,
        previousDistance: -1,
      };
    }
    function updateEffects(
      frame: TrainingAudioFrame,
      audible: boolean,
      speech: boolean,
      now: number,
      scheduled: number,
    ): void {
      if (!effects) return;
      if (
        audible &&
        (frame.formationProgress > 0 || (frame.arrowFormationProgress ?? 0) > 0)
      )
        effects.roomRevealed = true;
      const windPlaying = audible && effects.roomRevealed;
      const windChanged = windPlaying !== effects.windPlaying;
      if (windChanged) {
        if (windPlaying) {
          // Tone evaluates scheduled source state. A rapid resume must start
          // after its pending fade/stop, otherwise that stop kills the new loop.
          const startsAt = Math.max(
            scheduled,
            effects.windStoppedAt + SOURCE_RESTART_GAP_SECONDS,
          );
          effects.wind.start(startsAt, effects.windOffset);
          effects.windStartedAt = startsAt;
        } else {
          effects.windStoppedAt = Math.max(
            scheduled + PAUSE_RELEASE_SECONDS,
            effects.windStartedAt + SOURCE_RESTART_GAP_SECONDS,
          );
          effects.wind.stop(effects.windStoppedAt);
          effects.windOffset =
            (effects.windOffset +
              Math.max(0, effects.windStoppedAt - effects.windStartedAt)) %
            effects.duration;
        }
        effects.windPlaying = windPlaying;
      }
      const count = frame.passageCount;
      const newPassage =
        count !== undefined &&
        Number.isInteger(count) &&
        count >= 0 &&
        effects.previousPassageCount >= 0 &&
        count > effects.previousPassageCount;
      if (count !== undefined && Number.isInteger(count) && count >= 0)
        effects.previousPassageCount = count;
      if (!audible && effects.passagePlaying) {
        effects.passage.stop(scheduled + PAUSE_RELEASE_SECONDS);
        effects.passagePlaying = false;
      }
      if (
        audible &&
        newPassage &&
        frame.passagePosition &&
        frame.phase !== "missed" &&
        scheduled >= effects.passageAvailableAt
      ) {
        const position = frame.passagePosition;
        effects.placement.setPosition(position.x, position.y, position.z);
        // Closely spaced hits coalesce rather than moving an audible old source.
        effects.passage.start(scheduled);
        effects.passageAvailableAt = scheduled + effects.passageDuration;
        effects.passagePlaying = true;
      }
      const level = audible ? (speech ? parameters.room.speechGain : 1) : 0;
      const distance = effects.placement.readDistanceMeters();
      if (
        !windChanged &&
        level === effects.previousLevel &&
        Math.abs(distance - effects.previousDistance) <= 0.05
      )
        return;
      holdAudioParameter(effects.windGain.gain, now);
      holdAudioParameter(effects.direct.gain, now);
      holdAudioParameter(effects.send.gain, now);
      if (!audible) {
        effects.windGain.gain.setTargetAtTime(
          0,
          now,
          PAUSE_RELEASE_SECONDS / 4,
        );
        effects.direct.gain.setTargetAtTime(0, now, PAUSE_RELEASE_SECONDS / 4);
        effects.send.gain.setTargetAtTime(0, now, PAUSE_RELEASE_SECONDS / 4);
      } else {
        const reference = parameters.referenceDistanceMeters;
        const attenuation =
          reference /
          (reference +
            parameters.rolloffFactor *
              (Math.max(reference, distance) - reference));
        effects.windGain.gain.setTargetAtTime(
          windPlaying ? level : 0,
          now,
          windPlaying ? LEVEL_RAMP_SECONDS : PAUSE_RELEASE_SECONDS / 4,
        );
        effects.direct.gain.setTargetAtTime(
          level * parameters.room.dryGain,
          now,
          LEVEL_RAMP_SECONDS,
        );
        effects.send.gain.setTargetAtTime(
          parameters.room.sendGain * attenuation,
          now,
          LEVEL_RAMP_SECONDS,
        );
      }
      effects.previousLevel = level;
      effects.previousDistance = distance;
    }
    let releaseStartedAt: number | undefined;
    let releasePaused = false;
    function fadeOut(
      parameter: AudioParam,
      now: number,
      seconds: number,
    ): void {
      holdAudioParameter(parameter, now);
      parameter.linearRampToValueAtTime(0, now + seconds);
    }
    function releaseVoice(
      entry: (typeof voices)[number],
      now: number,
      seconds: number,
    ): void {
      if (
        !entry.playing ||
        (entry.releaseAt > 0 && entry.releaseAt <= now + seconds)
      )
        return;
      entry.releaseAt = now + seconds;
      fadeOut(entry.direct.gain, now, seconds);
      fadeOut(entry.send.gain, now, seconds);
    }
    function beginRelease(): void {
      if (isUnloaded || releaseStartedAt !== undefined) return;
      const now = audio.context.immediate();
      releaseStartedAt = now;
      for (const entry of voices)
        releaseVoice(entry, now, SOURCE_RELEASE_SECONDS);
      if (effects) {
        fadeOut(effects.windGain.gain, now, SOURCE_RELEASE_SECONDS);
        fadeOut(effects.direct.gain, now, SOURCE_RELEASE_SECONDS);
        fadeOut(effects.send.gain, now, SOURCE_RELEASE_SECONDS);
        if (effects.windPlaying)
          effects.wind.stop(audio.context.now() + SOURCE_RELEASE_SECONDS);
      }
      // The hall survives the handoff; its last samples reach zero before disposal.
      fadeOut(wetOutput.gain, now, HALL_RELEASE_SECONDS);
    }
    function updateRelease(isPlaying: boolean): boolean {
      if (isUnloaded) return true;
      if (releaseStartedAt === undefined) return false;
      const now = audio.context.immediate();
      if (!isPlaying && !releasePaused) {
        releasePaused = true;
        for (const entry of voices) {
          fadeOut(entry.direct.gain, now, PAUSE_RELEASE_SECONDS);
          fadeOut(entry.send.gain, now, PAUSE_RELEASE_SECONDS);
          if (entry.playing) entry.releaseAt = now + PAUSE_RELEASE_SECONDS;
        }
        if (effects) {
          fadeOut(effects.windGain.gain, now, PAUSE_RELEASE_SECONDS);
          fadeOut(effects.direct.gain, now, PAUSE_RELEASE_SECONDS);
          fadeOut(effects.send.gain, now, PAUSE_RELEASE_SECONDS);
        }
        fadeOut(wetOutput.gain, now, PAUSE_RELEASE_SECONDS);
      }
      for (const entry of voices) {
        if (entry.playing && now >= entry.releaseAt) {
          entry.voice.stop(audio.context.now());
          entry.playing = false;
        }
      }
      return now - releaseStartedAt >= HALL_RELEASE_SECONDS;
    }
    let previousAudible = false;
    let previousSpeech = false;
    let previousGoalIndex = -1;
    let previousAttempt = -1;
    return {
      update(frame, isPlaying, speechActive = false): void {
        if (isUnloaded) return;
        if (releaseStartedAt !== undefined) {
          updateRelease(isPlaying);
          return;
        }
        const audible = isPlaying && audio.context.state === "running";
        const objectsAudible =
          audible && frame.objects !== undefined && frame.phase !== "complete";
        const speech = speechActive;
        const now = audio.context.immediate();
        const scheduled = audio.context.now();
        updateEffects(frame, audible, speech, now, scheduled);
        const newCourse =
          frame.goalIndex !== previousGoalIndex ||
          frame.attempt !== previousAttempt;
        previousGoalIndex = frame.goalIndex;
        previousAttempt = frame.attempt;
        if (audible !== previousAudible || speech !== previousSpeech) {
          holdAudioParameter(wetOutput.gain, now);
          if (!isPlaying) fadeOut(wetOutput.gain, now, PAUSE_RELEASE_SECONDS);
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
          if (newCourse) {
            entry.pendingSelection = entry.object !== "arrow";
            releaseVoice(entry, now, SOURCE_RELEASE_SECONDS);
          }
          const visibleStrength =
            entry.object === "arrow"
              ? (frame.arrowFormationProgress ?? frame.formationProgress)
              : frame.formationProgress;
          if (!objectsAudible || visibleStrength <= 0)
            releaseVoice(
              entry,
              now,
              isPlaying ? SOURCE_RELEASE_SECONDS : PAUSE_RELEASE_SECONDS,
            );
          if (entry.releaseAt > 0) {
            // A retiring voice keeps its old spatial anchor until its gain is zero.
            if (now < entry.releaseAt) continue;
            entry.voice.stop(scheduled);
            entry.playing = false;
            entry.releaseAt = 0;
            entry.strength = -1;
          }
          if (entry.pendingSelection) {
            entry.pendingSelection = false;
            // Skip the previous sample without retry loops or new decoded buffers.
            if (samplePool.length > 1)
              entry.sampleIndex =
                (entry.sampleIndex +
                  1 +
                  Math.floor(random() * (samplePool.length - 1))) %
                samplePool.length;
            const sample = samplePool[entry.sampleIndex];
            if (sample) {
              entry.voice.buffer.set(sample);
              const grainSpan =
                (entry.recipe.grainSizeSeconds / entry.recipe.playbackRate +
                  entry.recipe.overlapSeconds) *
                2 **
                  ((entry.recipe.detuneCents +
                    (isGoal ? CROSSING_DETUNE_CENTS : 0)) /
                    1200);
              entry.offsetSeconds =
                random() * Math.max(0, sample.duration - grainSpan);
            }
          }
          const position = entry.object
            ? frame.objects?.[entry.object]
            : frame.goalPosition;
          if (position)
            entry.placement.setPosition(position.x, position.y, position.z);
          const strength =
            objectsAudible && (!isGoal || frame.phase !== "arrival")
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    entry.object === "arrow"
                      ? (frame.arrowFormationProgress ??
                          frame.formationProgress)
                      : frame.formationProgress,
                  ),
                )
              : 0;
          const playing = strength > 0;
          if (playing !== entry.playing) {
            entry.playing = playing;
            if (playing) entry.voice.start(scheduled, entry.offsetSeconds);
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
            holdAudioParameter(entry.filter.frequency, now);
            entry.filter.frequency.setTargetAtTime(
              parameters.room.nearCutoffHz *
                (parameters.room.farCutoffHz / parameters.room.nearCutoffHz) **
                  far,
              now,
              LEVEL_RAMP_SECONDS,
            );
            holdAudioParameter(entry.direct.gain, now);
            holdAudioParameter(entry.send.gain, now);
            if (!playing) {
              entry.direct.gain.setTargetAtTime(0, now, LEVEL_RAMP_SECONDS);
              entry.send.gain.setTargetAtTime(0, now, LEVEL_RAMP_SECONDS);
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
              (frame.phase === "missed"
                ? -1
                : Number(
                    frame.phase === "crossed" || frame.phase === "complete",
                  )) *
                CROSSING_DETUNE_CENTS;
        }
      },
      reset(): void {
        if (!effects || isUnloaded || releaseStartedAt !== undefined) return;
        effects.roomRevealed = false;
        effects.previousPassageCount = -1;
      },
      beginRelease,
      updateRelease,
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
  const { samples, layers, goal, room, effects } = parameters;
  const validEffects =
    !effects ||
    [effects.wind, effects.passage].every(
      (effect) =>
        effect &&
        typeof effect.url === "string" &&
        effect.url.length > 0 &&
        inRange(effect.volumeDb, -80, 0),
    );
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
    !validEffects ||
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
