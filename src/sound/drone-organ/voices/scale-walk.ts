/**
 * Purpose: Play a melody nobody wrote: a random walk over the world scale.
 * Context: Density, not notes, is what the composition sets — every step lands
 *   on the shared scale, so any two walking voices agree by construction.
 * Responsibility: Own the grid, the walk, and the note trigger.
 * Boundary: The instrument, its routing, and its disposal belong to the voice.
 */

import { Frequency } from "tone";
import { stepRandom } from "../organ-random";
import { createDerivedWalk } from "./derived-sequences";
import type { MelodyInstrument } from "./melody-instrument";
import type { VoiceContext } from "./organ-voice";

/** Hash channel of the roll that decides whether a step sounds. */
const DENSITY_CHANNEL = 20;

export interface ScaleWalkSettings {
  readonly instrument: MelodyInstrument;
  readonly stepSeconds: number; // Show seconds one step lasts.
  readonly noteDurationSeconds: number;
  readonly baseOctave: number; // Octaves above the world root.
  readonly octaves: number; // Range the walk may cover.
  readonly velocity: number;
  readonly density: number; // 0..1 chance a step sounds at all.
}

export function createScaleWalk(
  context: VoiceContext,
  settings: ScaleWalkSettings,
): void {
  const { harmony, salt } = context;
  const scaleLength = harmony.scaleSemitones.length;
  const walk = createDerivedWalk(scaleLength * settings.octaves, salt);

  context.lane.addSteps(settings.stepSeconds, (step, time) => {
    if (settings.density <= 0.02) return;
    if (stepRandom(step, DENSITY_CHANNEL, salt) > settings.density) return;

    const degree = walk.degreeAt(step);
    const octave = Math.floor(degree / scaleLength);
    const semitones = harmony.scaleSemitones[degree % scaleLength] ?? 0;
    const midi =
      harmony.rootMidi + settings.baseOctave * 12 + octave * 12 + semitones;
    settings.instrument.triggerAttackRelease(
      Frequency(midi, "midi").toFrequency(),
      settings.noteDurationSeconds,
      time,
      settings.velocity,
    );
  });
}
