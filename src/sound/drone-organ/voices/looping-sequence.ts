/**
 * Purpose: Play a short locked sequence that slowly mutates as it repeats.
 * Context: A recognizable loop is what gives the bass an identity; the mutation
 *   is what keeps it from becoming furniture.
 * Responsibility: Own the transport loop, the step memory, and the mutation.
 * Boundary: The instrument, its routing, and its disposal belong to the voice.
 */

import { Frequency, Loop } from "tone";
import type { OrganHarmony } from "../organ-harmony";
import type { MelodyInstrument } from "./melody-instrument";

/** Steps held in memory; `length` decides how many of them are played. */
const SEQUENCE_CAPACITY = 16;

/** How many steps a full turn may rewrite, at mutation 1. */
const MUTATION_REACH = 0.3;

/** Scale degrees a mutating step may move by. */
const MUTATION_STEPS = [-2, -1, 1, 2] as const;

interface SequenceStep {
  degree: number;
  isOpen: boolean;
  /** Fixed threshold: density picks a subset of steps rather than dicing each. */
  threshold: number;
}

export interface LoopingSequenceSettings {
  readonly instrument: MelodyInstrument;
  readonly interval: string; // Transport grid one step lasts, e.g. "8n".
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
  readonly dispose: () => void;
}

export function createLoopingSequence(
  harmony: OrganHarmony,
  settings: LoopingSequenceSettings,
): LoopingSequence {
  const span = harmony.scaleSemitones.length * settings.octaves;
  const length = Math.max(2, Math.min(SEQUENCE_CAPACITY, settings.length));
  let baseOctave = settings.baseOctave;
  let position = 0;
  let hasSounded = false;

  const sequence: SequenceStep[] = Array.from(
    { length: SEQUENCE_CAPACITY },
    () => ({
      degree: Math.floor(Math.random() * span),
      isOpen: Math.random() < 0.75,
      threshold: Math.random(),
    }),
  );

  function mutate(): void {
    for (const step of sequence) {
      if (Math.random() >= settings.mutation * MUTATION_REACH) continue;

      if (Math.random() < 0.65) {
        const move =
          MUTATION_STEPS[Math.floor(Math.random() * MUTATION_STEPS.length)] ??
          0;
        step.degree = Math.max(0, Math.min(span - 1, step.degree + move));
      } else {
        step.isOpen = !step.isOpen;
      }
    }
  }

  const loop = new Loop((time) => {
    if (settings.density <= 0.02) return;

    const index = position % length;
    position += 1;
    if (index === 0 && hasSounded && settings.mutation > 0) mutate();

    const step = sequence[index];
    if (!step) return;

    // The first step always sounds, so the loop announces itself immediately.
    if (!hasSounded) {
      step.isOpen = true;
      step.threshold = 0;
    }
    hasSounded = true;
    if (!step.isOpen || step.threshold > settings.density) return;

    const scaleLength = harmony.scaleSemitones.length;
    const degree = Math.min(step.degree, span - 1);
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
  }, settings.interval).start(0);

  return {
    setBaseOctave: (octave): void => {
      baseOctave = octave;
    },

    dispose: (): void => {
      loop.dispose();
    },
  };
}
