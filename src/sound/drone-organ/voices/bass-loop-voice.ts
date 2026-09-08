/**
 * Purpose: A locked bass sequence that slowly rewrites itself.
 * Context: The thermal world's ground line — recognizable enough to be
 *   remembered, restless enough never to settle.
 * Responsibility: Build the mono synth, its room, and the looping sequence.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { type Gain, MonoSynth } from "tone";
import { createEchoRoom, type EchoRoomSettings } from "./echo-room";
import { createLoopingSequence } from "./looping-sequence";
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
  const bass = new MonoSynth({
    oscillator: { type: settings.wood < 0.5 ? "square" : "sawtooth" },
    filter: { Q: 3, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.3 },
    filterEnvelope: {
      attack: 0.005,
      decay: 0.14,
      sustain: 0.3,
      release: 0.4,
      baseFrequency: 110,
      octaves: 2.5,
    },
    volume: -9,
  });
  const room = createEchoRoom(bus, settings.room);
  bass.connect(room.input);

  bass.filterEnvelope.decay = 0.04 + settings.pluck * 0.5;

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
      bass.filterEnvelope.octaves = 1 + x * 4;
      bass.filter.Q.rampTo(0.5 + x * 9, 0.1);
      sequence.setBaseOctave(Math.round(y * 2));
    },

    dispose: (): void => {
      bass.dispose();
      room.dispose();
    },
  };
}
