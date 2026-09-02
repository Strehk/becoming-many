/**
 * Purpose: Play a melody nobody wrote: a random walk over the world scale.
 * Context: Density, not notes, is what the composition sets — every step lands
 *   on the shared scale, so any two walking voices agree by construction.
 * Responsibility: Own the transport loop, the walk, and the note trigger.
 * Boundary: The instrument, its routing, and its disposal belong to the voice.
 */

import { Frequency, Loop } from "tone";
import type { OrganHarmony } from "../organ-harmony";
import type { MelodyInstrument } from "./melody-instrument";

/** Step sizes drawn per tick: small moves are likelier than leaps. */
const WALK_STEPS = [-2, -1, -1, 0, 1, 1, 2] as const;

export interface ScaleWalkSettings {
  readonly instrument: MelodyInstrument;
  readonly interval: string; // Transport grid one step lasts, e.g. "2n".
  readonly noteDuration: string | number;
  readonly baseOctave: number; // Octaves above the world root.
  readonly octaves: number; // Range the walk may cover.
  readonly velocity: number;
  readonly density: number; // 0..1 chance a step sounds at all.
}

export interface ScaleWalk {
  readonly dispose: () => void;
}

export function createScaleWalk(
  harmony: OrganHarmony,
  settings: ScaleWalkSettings,
): ScaleWalk {
  const span = harmony.scaleSemitones.length * settings.octaves;
  let degree = Math.floor(Math.random() * harmony.scaleSemitones.length);
  // The first tick always sounds. Without it a sparse voice can stay silent
  // for many seconds after the layer opens, which reads as a broken patch.
  let hasSounded = false;

  const loop = new Loop((time) => {
    if (settings.density <= 0.02) return;
    if (hasSounded && Math.random() > settings.density) return;
    hasSounded = true;

    const step = WALK_STEPS[Math.floor(Math.random() * WALK_STEPS.length)] ?? 0;
    degree = Math.max(0, Math.min(span - 1, degree + step));

    const scaleLength = harmony.scaleSemitones.length;
    const octave = Math.floor(degree / scaleLength);
    const semitones = harmony.scaleSemitones[degree % scaleLength] ?? 0;
    const midi =
      harmony.rootMidi + settings.baseOctave * 12 + octave * 12 + semitones;
    settings.instrument.triggerAttackRelease(
      Frequency(midi, "midi").toFrequency(),
      settings.noteDuration,
      time,
      settings.velocity,
    );
  }, settings.interval).start(0);

  return {
    dispose: (): void => {
      loop.dispose();
    },
  };
}
