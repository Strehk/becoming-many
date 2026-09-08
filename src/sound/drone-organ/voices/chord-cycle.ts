/**
 * Purpose: Turn a fixed chord progression into a breathing melodic voice.
 * Context: The choir needs harmony under its surface without anyone playing
 *   notes: the progression turns on show time while a voice walks up the
 *   chord it currently stands in.
 * Responsibility: Own both grids, the progression, and the triggers.
 * Boundary: The instrument and what a chord change sounds like belong to the
 *   voice that supplies them.
 */

import { Frequency } from "tone";
import { stepRandom } from "../organ-random";
import type { MelodyInstrument } from "./melody-instrument";
import type { VoiceContext } from "./organ-voice";

/** One chord relative to the world root, in semitones. */
interface Chord {
  readonly rootOffset: number;
  readonly intervals: readonly number[];
}

/**
 * The composed progression: i · III · VI · VII, a minor circle that never
 * resolves. The composition selects no other chords, so the palette it chose
 * from is not carried over.
 */
const PROGRESSION: readonly Chord[] = [
  { rootOffset: 0, intervals: [0, 3, 7] },
  { rootOffset: 3, intervals: [0, 4, 7] },
  { rootOffset: 8, intervals: [0, 4, 7] },
  { rootOffset: 10, intervals: [0, 4, 7] },
];

/** Hash channel of the roll that decides whether a step sounds. */
const DENSITY_CHANNEL = 21;

/** Guards `ceil` against a chord boundary landing a rounding error late. */
const GRID_EPSILON = 1e-9;

export interface ChordCycleSettings {
  readonly instrument: MelodyInstrument;
  readonly stepSeconds: number; // Show seconds the walking voice steps on.
  readonly noteDurationSeconds: number;
  readonly baseOctave: number; // Octaves above the world root.
  readonly octaves: number; // How many octaves the chord is spread over.
  readonly velocity: number;
  readonly density: number; // 0..1 chance a step sounds at all.
  readonly chordSeconds: number; // How long one chord holds.

  /** What a chord change itself sounds like, if the voice wants one. */
  readonly onChordChange?: (midiNotes: readonly number[], time: number) => void;
}

export interface ChordCycle {
  readonly setBaseOctave: (octave: number) => void;
  readonly setOctaves: (octaves: number) => void;
}

export function createChordCycle(
  context: VoiceContext,
  settings: ChordCycleSettings,
): ChordCycle {
  const { harmony, salt } = context;
  let baseOctave = settings.baseOctave;
  let octaves = settings.octaves;

  function chordNotes(chordOrdinal: number): readonly number[] {
    const chord = PROGRESSION[chordOrdinal % PROGRESSION.length];
    if (!chord) return [];

    const base = harmony.rootMidi + baseOctave * 12 + chord.rootOffset;
    const notes: number[] = [];
    for (let octave = 0; octave < octaves; octave += 1) {
      for (const interval of chord.intervals) {
        notes.push(base + interval + octave * 12);
      }
    }
    return notes;
  }

  function sounds(step: number): boolean {
    return stepRandom(step, DENSITY_CHANNEL, salt) <= settings.density;
  }

  context.lane.addSteps(settings.chordSeconds, (chordOrdinal, time) => {
    settings.onChordChange?.(chordNotes(chordOrdinal), time);
  });

  context.lane.addSteps(settings.stepSeconds, (step, time) => {
    if (settings.density <= 0.02 || !sounds(step)) return;

    // The chord this step stands in, and how many steps have sounded since it
    // began: the voice walks up the chord one sounding step at a time.
    const chordOrdinal = Math.floor(
      (step * settings.stepSeconds) / settings.chordSeconds,
    );
    const chordFirstStep = Math.ceil(
      (chordOrdinal * settings.chordSeconds) / settings.stepSeconds -
        GRID_EPSILON,
    );
    let soundedBefore = 0;
    for (let earlier = chordFirstStep; earlier < step; earlier += 1) {
      if (sounds(earlier)) soundedBefore += 1;
    }

    const notes = chordNotes(chordOrdinal);
    const note = notes[soundedBefore % notes.length];
    if (note === undefined) return;

    settings.instrument.triggerAttackRelease(
      Frequency(note, "midi").toFrequency(),
      settings.noteDurationSeconds,
      time,
      settings.velocity,
    );
  });

  return {
    setBaseOctave: (octave): void => {
      baseOctave = octave;
    },

    setOctaves: (value): void => {
      octaves = value;
    },
  };
}
