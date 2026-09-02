/**
 * Purpose: Name the shared tonal ground every drone-organ voice plays over.
 * Context: All melodic voices read one root and one scale, which is why layers
 *   stacked in any combination still agree harmonically.
 * Responsibility: Carry the resolved root note and scale degrees.
 * Boundary: Who owns the audio graph is the engine's concern; the authored
 *   values live in the composition settings.
 */

/** The tonal ground, resolved from the authored composition once at startup. */
export interface OrganHarmony {
  /** MIDI number of the world root; every voice is transposed from it. */
  readonly rootMidi: number;

  /** Scale degrees in semitones above the root, ascending within one octave. */
  readonly scaleSemitones: readonly number[];
}
