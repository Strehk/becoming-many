import { PositionalAudio, Quaternion, Vector3 } from "three";
import { connect, GrainPlayer, Limiter, Player, Reverb } from "tone";
import type {
  AudioRing,
  AudioSection,
  AudioSectionFrame,
  StartAudio,
  StartAudioOptions,
  StartAudioSettings,
} from "./audio-contract";

// Chapter 1 — Shared preparation and owned resources.
type Voice = {
  player: Player | GrainPlayer;
  gain: GainNode;
  spatial?: PositionalAudio;
  offset: number;
  targetGain: number;
};
type Ring = { index: number; pulse: Voice; clicks: Voice[]; counter: number };
type Section = { rings: Ring[]; beds: Voice[] };
type Buffers = Record<
  "ring_pulse" | "ring_clicking" | "ring_base" | "pad",
  AudioBuffer
>;

/** Uses the existing context and listener; callers own their lifetime and pose. */
export async function createStartAudio(
  options: StartAudioOptions,
): Promise<StartAudio> {
  validateSettings(options.settings);
  const buffers = await loadBuffers(options);
  options.signal?.throwIfAborted();
  const audio = new SpatialAtmosphere(options, buffers);
  try {
    await audio.prepare();
    options.signal?.throwIfAborted();
    return audio;
  } catch (error) {
    audio.unload();
    throw error;
  }
}

function validateSettings(settings: StartAudioSettings): void {
  for (const [name, value] of Object.entries(settings)) {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new RangeError(`Invalid audio setting: ${name}`);
  }
  const counts = [
    settings.sectionCapacity,
    settings.ringCapacity,
    settings.clickingSources,
    settings.baseHeads,
  ];
  if (counts.some((count) => !Number.isInteger(count) || count < 1))
    throw new RangeError("Audio capacities must be positive integers");
  validateDurations(settings);
  if (settings.minimumDetuneCents > 0 || settings.rolloff < 0)
    throw new RangeError("Invalid audio detune or rolloff");
  const unit = [settings.reverbWet, settings.audiblePresence];
  if (unit.some((value) => value < 0 || value > 1))
    throw new RangeError(
      "Audio presence and wet mix must be between zero and one",
    );
  validateOverlap(settings.clickOverlapSeconds, settings.clickGrainSeconds);
  validateOverlap(settings.baseOverlapSeconds, settings.baseGrainSeconds);
  if (!settings.assetRoot) throw new RangeError("Audio asset root is required");
}

function validateDurations(settings: StartAudioSettings): void {
  const positive = [
    settings.fadeSeconds,
    settings.clickGrainSeconds,
    settings.baseGrainSeconds,
    settings.ringRefDistance,
    settings.baseRefDistance,
    settings.reverbSeconds,
  ];
  if (positive.some((value) => value <= 0))
    throw new RangeError("Audio durations and distances must be positive");
}

function validateOverlap(overlap: number, grain: number): void {
  if (overlap < 0 || overlap >= grain)
    throw new RangeError(
      "Grain overlap must be nonnegative and smaller than the grain",
    );
}

function validateRing(ring: AudioRing, capacity: number): void {
  if (!Number.isInteger(ring.index) || ring.index < 0 || ring.index >= capacity)
    throw new RangeError("Invalid audio ring index");
  const coordinates = [
    ...ring.center.toArray(),
    ...ring.direction.toArray(),
    ring.radiusMeters,
  ];
  if (
    !coordinates.every(Number.isFinite) ||
    ring.radiusMeters <= 0 ||
    ring.direction.lengthSq() === 0
  )
    throw new RangeError("Invalid audio ring geometry");
}

async function loadBuffers(options: StartAudioOptions): Promise<Buffers> {
  const names = ["ring_pulse", "ring_clicking", "ring_base", "pad"] as const;
  const entries = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`${options.settings.assetRoot}${name}.wav`, {
        signal: options.signal,
      });
      if (!response.ok)
        throw new Error(
          `Cannot load Start atmosphere: ${name} (${response.status})`,
        );
      const buffer = await options.listener.context.decodeAudioData(
        await response.arrayBuffer(),
      );
      return [name, buffer] as const;
    }),
  );
  return Object.fromEntries(entries) as Buffers;
}

class SpatialAtmosphere implements StartAudio {
  private readonly sections = new Map<number, Section>();
  private readonly voices = new Set<Voice>();
  private readonly reverb: Reverb;
  private readonly limiter: Limiter;
  private readonly pad: Voice;
  private active = false;
  private disposed = false;

  constructor(
    private readonly options: StartAudioOptions,
    private readonly buffers: Buffers,
  ) {
    const { context, settings, listener } = options;
    this.reverb = new Reverb({
      context,
      decay: settings.reverbSeconds,
      wet: settings.reverbWet,
    });
    this.limiter = new Limiter({ context, threshold: settings.limiterDb });
    this.reverb.connect(this.limiter);
    this.limiter.connect(listener.getInput());
    this.pad = this.makeVoice(
      new Player({ context, url: buffers.pad, loop: true }),
    );
  }

  async prepare(): Promise<void> {
    await this.reverb.ready;
  }

  // Chapter 2 — Fixed-capacity sections and spatial placement.
  configureSection(slot: number, section: AudioSection): void {
    if (this.disposed) return;
    if (
      slot < 0 ||
      slot >= this.options.settings.sectionCapacity ||
      !Number.isInteger(slot)
    )
      throw new RangeError("Invalid audio section slot");
    this.validateSection(section);
    this.clearSection(slot);
    const retained = new Set(this.voices);
    try {
      const rings = section.rings.map((ring) => this.createRing(ring));
      const beds = Array.from(
        { length: this.options.settings.baseHeads },
        (_, index) => this.createBed(section.center, index),
      );
      this.sections.set(slot, { rings, beds });
    } catch (error) {
      for (const voice of this.voices)
        if (!retained.has(voice)) this.disposeVoice(voice);
      throw error;
    }
  }

  private validateSection(section: AudioSection): void {
    const capacity = this.options.settings.ringCapacity;
    if (section.rings.length > capacity)
      throw new RangeError("Audio ring capacity exceeded");
    if (!section.center.toArray().every(Number.isFinite))
      throw new RangeError("Invalid audio section center");
    const indices = new Set<number>();
    for (const ring of section.rings) {
      validateRing(ring, capacity);
      if (indices.has(ring.index))
        throw new RangeError("Duplicate audio ring index");
      indices.add(ring.index);
    }
  }

  private createRing(ring: AudioRing): Ring {
    const pulse = this.makeVoice(
      new Player({
        context: this.options.context,
        url: this.buffers.ring_pulse,
      }),
    );
    this.place(pulse, ring.center, this.options.settings.ringRefDistance);
    const clicks = Array.from(
      { length: this.options.settings.clickingSources },
      (_, index) => this.createClick(ring, index),
    );
    return { index: ring.index, pulse, clicks, counter: 0 };
  }

  private createClick(ring: AudioRing, index: number): Voice {
    const settings = this.options.settings;
    const player = new GrainPlayer({
      context: this.options.context,
      url: this.buffers.ring_clicking,
      loop: true,
      detune: Math.random() * settings.minimumDetuneCents,
      grainSize: settings.clickGrainSeconds,
      overlap: settings.clickOverlapSeconds,
    });
    const voice = this.makeVoice(player);
    voice.offset = Math.random() * this.buffers.ring_clicking.duration;
    const angle = (index * Math.PI * 2) / settings.clickingSources;
    const rotation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      ring.direction.clone().normalize(),
    );
    const position = new Vector3(Math.cos(angle), Math.sin(angle), 0)
      .multiplyScalar(ring.radiusMeters)
      .applyQuaternion(rotation)
      .add(ring.center);
    this.place(voice, position, settings.ringRefDistance);
    return voice;
  }

  private createBed(center: Vector3, index: number): Voice {
    const settings = this.options.settings;
    const voice = this.makeVoice(
      new GrainPlayer({
        context: this.options.context,
        url: this.buffers.ring_base,
        loop: true,
        detune: 0,
        grainSize: settings.baseGrainSeconds,
        overlap: settings.baseOverlapSeconds,
      }),
    );
    voice.offset =
      (this.buffers.ring_base.duration * index) / settings.baseHeads;
    this.place(voice, center, settings.baseRefDistance);
    return voice;
  }

  private makeVoice(player: Voice["player"]): Voice {
    let gain: GainNode | undefined;
    try {
      gain = this.options.listener.context.createGain();
      gain.gain.value = 0;
      player.connect(gain);
      connect(gain, this.reverb);
      const voice = { player, gain, offset: 0, targetGain: 0 };
      this.voices.add(voice);
      return voice;
    } catch (error) {
      player.dispose();
      gain?.disconnect();
      throw error;
    }
  }

  private place(voice: Voice, position: Vector3, reference: number): void {
    const spatial = new PositionalAudio(this.options.listener);
    voice.spatial = spatial;
    voice.gain.disconnect();
    spatial.gain.disconnect();
    spatial.setNodeSource(voice.gain);
    spatial
      .setRefDistance(reference)
      .setRolloffFactor(this.options.settings.rolloff);
    spatial.setDistanceModel("inverse");
    spatial.position.copy(position);
    spatial.updateMatrixWorld(true);
    // The shared reverb receives only the post-distance, post-pan signal.
    connect(spatial.gain, this.reverb);
  }

  // Chapter 3 — Visibility and visual-pulse synchronization.
  updateSection(slot: number, frame: AudioSectionFrame): void {
    const section = this.sections.get(slot);
    if (!section || this.disposed) return;
    let presence = 0;
    for (const ring of section.rings) {
      const amount = Math.max(0, Math.min(1, frame.presence[ring.index] ?? 0));
      presence = Math.max(presence, amount);
      this.updateRing(ring, { amount, counter: frame.pulses[ring.index] ?? 0 });
    }
    for (const bed of section.beds)
      this.loop(
        bed,
        presence,
        this.options.settings.baseDb - 10 * Math.log10(section.beds.length),
      );
  }

  private updateRing(
    ring: Ring,
    frame: { amount: number; counter: number },
  ): void {
    const settings = this.options.settings;
    for (const click of ring.clicks)
      this.loop(click, frame.amount, settings.clickingDb);
    this.volume(ring.pulse, this.active ? frame.amount : 0, settings.pulseDb);
    if (
      this.active &&
      frame.amount > settings.audiblePresence &&
      frame.counter > ring.counter
    )
      ring.pulse.player.start(this.options.context.immediate());
    ring.counter = frame.counter;
  }

  update(frame: { active: boolean; speaking: boolean }): void {
    if (this.disposed) return;
    this.active = frame.active && this.options.context.state === "running";
    const settings = this.options.settings;
    this.loop(
      this.pad,
      1,
      frame.speaking ? settings.padSpeakingDb : settings.padDb,
    );
    if (this.active) return;
    for (const section of this.sections.values()) this.silence(section);
  }

  private loop(voice: Voice, presence: number, db: number): void {
    const audible =
      this.active && presence > this.options.settings.audiblePresence;
    if (audible && voice.player.state !== "started")
      voice.player.start(undefined, voice.offset);
    this.volume(voice, audible ? presence : 0, db);
    if (!audible && voice.player.state === "started") voice.player.stop();
  }

  private volume(voice: Voice, presence: number, db: number): void {
    const target = presence * 10 ** (db / 20);
    if (voice.targetGain === target) return;
    voice.targetGain = target;
    const context = this.options.listener.context;
    voice.gain.gain.cancelAndHoldAtTime(context.currentTime);
    voice.gain.gain.setTargetAtTime(
      target,
      context.currentTime,
      this.options.settings.fadeSeconds,
    );
  }

  private silence(section: Section): void {
    for (const ring of section.rings) {
      this.volume(ring.pulse, 0, 0);
      for (const click of ring.clicks) this.loop(click, 0, 0);
    }
    for (const bed of section.beds) this.loop(bed, 0, 0);
  }

  // Chapter 4 — Complete section and module disposal.
  clearSection(slot: number): void {
    const section = this.sections.get(slot);
    if (!section) return;
    for (const ring of section.rings) {
      this.disposeVoice(ring.pulse);
      for (const click of ring.clicks) this.disposeVoice(click);
    }
    for (const bed of section.beds) this.disposeVoice(bed);
    this.sections.delete(slot);
  }

  private disposeVoice(voice: Voice): void {
    this.voices.delete(voice);
    voice.player.dispose();
    voice.gain.disconnect();
    voice.spatial?.panner.disconnect();
    voice.spatial?.gain.disconnect();
  }

  unload(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.sections.keys()) this.clearSection(slot);
    for (const voice of this.voices) this.disposeVoice(voice);
    this.reverb.dispose();
    this.limiter.dispose();
  }
}
