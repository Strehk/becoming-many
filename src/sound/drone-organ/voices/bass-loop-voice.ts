/**
 * Purpose: A locked bass sequence that slowly rewrites itself.
 * Context: The thermal world's ground line — recognizable enough to be
 *   remembered, restless enough never to settle.
 * Responsibility: Build the bass body, its room, and the looping sequence.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import {
  AmplitudeEnvelope,
  Filter,
  FrequencyEnvelope,
  type Gain,
  Oscillator,
  Volume,
} from "tone";
import { createEchoRoom, type EchoRoomSettings } from "./echo-room";
import { createLoopingSequence } from "./looping-sequence";
import type { MelodyInstrument } from "./melody-instrument";
import type { OrganVoice, VoiceContext } from "./organ-voice";

export interface BassLoopSettings {
  readonly pluck: number; // 0..1 how fast the filter envelope closes.
  readonly noteLength: number; // 0..1 how long one step is held.
  readonly wood: number; // Below 0.5 a square wave, from 0.5 a sawtooth.
  readonly melodyDensity: number; // 0..1 share of steps that sound.
  readonly sequenceLength: number; // Steps before the loop turns over.
  readonly mutation: number; // 0..1 how much a turn rewrites.
  readonly room: EchoRoomSettings;
}

export function createBassLoopVoice(
  bus: Gain,
  context: VoiceContext,
  settings: BassLoopSettings,
): OrganVoice {
  // A mono synth built from parts that live as long as the voice: one
  // oscillator, started with the first note and only ever gated after it, so
  // no note leaves a native oscillator behind in the audio graph.
  const oscillator = new Oscillator({
    type: settings.wood < 0.5 ? "square" : "sawtooth",
  });
  const filter = new Filter({ type: "lowpass", rolloff: -24, Q: 3 });
  const envelope = new AmplitudeEnvelope({
    attack: 0.005,
    decay: 0.25,
    sustain: 0.35,
    release: 0.3,
  });
  const filterEnvelope = new FrequencyEnvelope({
    attack: 0.005,
    decay: 0.04 + settings.pluck * 0.5,
    sustain: 0.3,
    release: 0.4,
    baseFrequency: 110,
    octaves: 2.5,
    exponent: 2,
  });
  const output = new Volume(-9);
  oscillator.chain(filter, envelope, output);
  filterEnvelope.connect(filter.frequency);
  const room = createEchoRoom(bus, settings.room);
  output.connect(room.input);

  let running = false;
  const bass: MelodyInstrument = {
    triggerAttackRelease(frequencyHertz, duration, time, velocity): void {
      if (!running) {
        oscillator.start(time);
        running = true;
      }
      oscillator.frequency.setValueAtTime(frequencyHertz, time);
      envelope.triggerAttackRelease(duration, time, velocity);
      filterEnvelope.triggerAttackRelease(duration, time);
    },
  };

  // Eighth notes: two steps to the beat.
  const sequence = createLoopingSequence(context, {
    instrument: bass,
    stepSeconds: context.harmony.pulseSeconds / 2,
    noteDurationSeconds: 0.08 + settings.noteLength * 0.7,
    baseOctave: 0,
    octaves: 2,
    velocity: 0.8,
    density: settings.melodyDensity,
    length: settings.sequenceLength,
    mutation: settings.mutation,
  });

  return {
    setPad: (x, y): void => {
      // Bite is the filter envelope reaching further and resonating harder.
      filterEnvelope.octaves = 1 + x * 4;
      filter.Q.rampTo(0.5 + x * 9, 0.1);
      sequence.setBaseOctave(Math.round(y * 2));
    },

    dispose: (): void => {
      for (const node of [
        oscillator,
        filter,
        envelope,
        filterEnvelope,
        output,
      ]) {
        node.dispose();
      }
      room.dispose();
    },
  };
}
