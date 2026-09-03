/**
 * Purpose: Play a short locked sequence that slowly mutates as it repeats.
 * Context: A recognizable loop is what gives the bass an identity; the mutation
 *   is what keeps it from becoming furniture.
 * Responsibility: Own the grid and the note trigger over the derived loop.
 * Boundary: The instrument, its routing, and its disposal belong to the voice.
 */

import { Frequency } from "tone";
import { createDerivedSequence } from "./derived-sequences";
import type { MelodyInstrument } from "./melody-instrument";
import type { VoiceContext } from "./organ-voice";

export interface LoopingSequenceSettings {
  readonly instrument: MelodyInstrument;
  readonly stepSeconds: number; // Show seconds one step lasts.
  readonly noteDurationSeconds: number;
  readonly baseOctave: number; // Octaves above the world root.
  readonly octaves: number; // Range the sequence draws its degrees from.
  readonly velocity: number;
  readonly density: number; // 0..1 share of steps that sound.
  readonly length: number; // Steps before the loop turns over.
  readonly mutation: number; // 0..1 how much a turn rewrites.
}

export interface LoopingSequence {
  readonly setBaseOctave: (octave: number) => void;
}

export function createLoopingSequence(
  context: VoiceContext,
  settings: LoopingSequenceSettings,
): LoopingSequence {
  const { harmony, salt } = context;
  const scaleLength = harmony.scaleSemitones.length;
  const sequence = createDerivedSequence({
    span: scaleLength * settings.octaves,
    length: settings.length,
    density: settings.density,
    mutation: settings.mutation,
    salt,
  });
  let baseOctave = settings.baseOctave;

  context.lane.addSteps(settings.stepSeconds, (step, time) => {
    const degree = sequence.degreeAt(step);
    if (degree === undefined) return;

    const midi =
      harmony.rootMidi +
      baseOctave * 12 +
      Math.floor(degree / scaleLength) * 12 +
      (harmony.scaleSemitones[degree % scaleLength] ?? 0);
    settings.instrument.triggerAttackRelease(
      Frequency(midi, "midi").toFrequency(),
      settings.noteDurationSeconds,
      time,
      settings.velocity,
    );
  });

  return {
    setBaseOctave: (octave): void => {
      baseOctave = octave;
    },
  };
}
