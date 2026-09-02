/**
 * Purpose: Turn a fixed chord progression into a breathing melodic voice.
 * Context: The choir needs harmony under its surface without anyone playing
 *   notes: the progression turns on its own clock while a voice walks up the
 *   chord it currently stands in.
 * Responsibility: Own both transport loops, the progression, and the triggers.
 * Boundary: The instrument and what a chord change sounds like belong to the
 *   voice that supplies them.
 */

import { Frequency, getTransport, Loop } from "tone";
import type { OrganHarmony } from "../organ-harmony";
import type { MelodyInstrument } from "./melody-instrument";

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

export interface ChordCycleSettings {
  readonly instrument: MelodyInstrument;
  readonly interval: string; // Transport grid the walking voice steps on.
  readonly noteDuration: string | number;
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
  readonly dispose: () => void;
}

export function createChordCycle(
  harmony: OrganHarmony,
  settings: ChordCycleSettings,
): ChordCycle {
  let baseOctave = settings.baseOctave;
  let octaves = settings.octaves;
  let chordIndex = -1;
  let step = 0;
  let hasSounded = false;

  function chordNotes(): readonly number[] {
    const chord = PROGRESSION[chordIndex];
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

  function advance(time: number): void {
    chordIndex = (chordIndex + 1) % PROGRESSION.length;
    step = 0;
    settings.onChordChange?.(chordNotes(), time);
  }

  const chordLoop = new Loop(advance, settings.chordSeconds).start(0);
  const noteLoop = new Loop((time) => {
    if (chordIndex < 0 || settings.density <= 0.02) return;
    if (hasSounded && Math.random() > settings.density) return;

    const notes = chordNotes();
    const note = notes[step % notes.length];
    if (note === undefined) return;

    hasSounded = true;
    step += 1;
    settings.instrument.triggerAttackRelease(
      Frequency(note, "midi").toFrequency(),
      settings.noteDuration,
      time,
      settings.velocity,
    );
  }, settings.interval).start(0);

  // Open on the first chord instead of after a full turn of the chord loop.
  getTransport().scheduleOnce(advance, "+0.15");

  return {
    setBaseOctave: (octave): void => {
      baseOctave = octave;
    },

    setOctaves: (value): void => {
      octaves = value;
    },

    dispose: (): void => {
      chordLoop.dispose();
      noteLoop.dispose();
    },
  };
}
