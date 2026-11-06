/**
 * Purpose: Play notes on a fixed set of oscillators that are started once.
 * Context: Tone's synths start a fresh native oscillator for every note and
 *   leave it connected to their long-lived pitch signals, so the audio graph
 *   grows with every note and every later connection gets slower. Over a day
 *   of shows that made the finale stutter.
 * Responsibility: Own a bounded pool of oscillator and envelope pairs, choose a
 *   free one per note, and set its pitch and envelope on the audio timeline.
 * Boundary: What a voice plays, and where its output goes, belongs to the voice.
 */

import {
  AmplitudeEnvelope,
  type EnvelopeCurve,
  Oscillator,
  Time,
  Volume,
} from "tone";
import type { MelodyInstrument } from "./melody-instrument";

export interface HeldEnvelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
  readonly attackCurve?: EnvelopeCurve;
}

export interface HeldOscillatorSettings {
  readonly type: "sine" | "triangle" | "square" | "sawtooth";
  /** Notes that may sound at once; a note beyond them is dropped. */
  readonly polyphony: number;
  readonly envelope: HeldEnvelope;
  readonly volumeDecibels: number;
  /**
   * A membrane's strike: each note starts this many times above its pitch and
   * falls onto it exponentially over `seconds`.
   */
  readonly pitchDrop?: { readonly ratio: number; readonly seconds: number };
}

export interface HeldOscillators extends MelodyInstrument {
  /** The pool's summed output; connect it onward like any Tone node. */
  readonly output: Volume;
  setEnvelope(
    envelope: Partial<Pick<HeldEnvelope, "attack" | "release">>,
  ): void;
  dispose(): void;
}

interface HeldVoice {
  readonly oscillator: Oscillator;
  readonly envelope: AmplitudeEnvelope;
  /** Audio time from which the voice is silent again. */
  freeAt: number;
  running: boolean;
}

export function createHeldOscillators(
  settings: HeldOscillatorSettings,
): HeldOscillators {
  const output = new Volume(settings.volumeDecibels);
  const voices: HeldVoice[] = [];
  for (let index = 0; index < Math.max(1, settings.polyphony); index += 1) {
    const oscillator = new Oscillator({ type: settings.type });
    const envelope = new AmplitudeEnvelope({ ...settings.envelope });
    oscillator.chain(envelope, output);
    voices.push({
      oscillator,
      envelope,
      freeAt: Number.NEGATIVE_INFINITY,
      running: false,
    });
  }

  return {
    output,

    triggerAttackRelease(frequencyHertz, duration, time, velocity): void {
      const voice = nextVoice(voices, time);
      if (!voice) return;
      const { oscillator, envelope } = voice;
      // A voice runs from its first note on and is only ever gated after it.
      if (!voice.running) {
        oscillator.start(time);
        voice.running = true;
      }
      const drop = settings.pitchDrop;
      if (drop) {
        oscillator.frequency.setValueAtTime(frequencyHertz * drop.ratio, time);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequencyHertz,
          time + drop.seconds,
        );
      } else {
        oscillator.frequency.setValueAtTime(frequencyHertz, time);
      }
      const seconds = Time(duration).toSeconds();
      envelope.triggerAttackRelease(seconds, time, velocity);
      voice.freeAt = time + seconds + Time(envelope.release).toSeconds();
    },

    setEnvelope(changes): void {
      for (const { envelope } of voices) {
        if (changes.attack !== undefined) envelope.attack = changes.attack;
        if (changes.release !== undefined) envelope.release = changes.release;
      }
    },

    dispose(): void {
      for (const { oscillator, envelope } of voices) {
        oscillator.dispose();
        envelope.dispose();
      }
      output.dispose();
    },
  };
}

/**
 * The voice that fell silent first. A single voice is retriggered even while it
 * still sounds, as a monophonic synth would be; a pool drops a note when every
 * voice is still busy, as Tone's polyphonic synth does.
 */
function nextVoice(
  voices: readonly HeldVoice[],
  time: number,
): HeldVoice | undefined {
  let earliest: HeldVoice | undefined;
  for (const voice of voices) {
    if (!earliest || voice.freeAt < earliest.freeAt) earliest = voice;
  }
  if (!earliest) return undefined;
  return voices.length === 1 || earliest.freeAt <= time ? earliest : undefined;
}
