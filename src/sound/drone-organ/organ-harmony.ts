/**
 * Purpose: Name the shared ground every drone-organ voice plays over: one
 *   root, one scale, one pulse.
 * Context: All melodic voices read one root and one scale, which is why layers
 *   stacked in any combination still agree harmonically; all rhythmic voices
 *   step on fractions of one pulse, which is why they lock without a clock of
 *   their own.
 * Responsibility: Carry the resolved root note, scale degrees, and beat length.
 * Boundary: Who owns the audio graph is the engine's concern; the root and
 *   scale are authored in the composition, the pulse in the dramaturgy's score.
 */

/** The shared ground, resolved once at startup. */
export interface OrganHarmony {
  /** MIDI number of the world root; every voice is transposed from it. */
  readonly rootMidi: number;

  /** Scale degrees in semitones above the root, ascending within one octave. */
  readonly scaleSemitones: readonly number[];

  /** One beat of the common pulse, in show seconds. */
  readonly pulseSeconds: number;
}
