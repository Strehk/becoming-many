/**
 * Purpose: Name what a generative voice needs from the instrument it plays.
 * Context: The walk, the chord cycle, and the looping sequence all drive a Tone
 *   synth, but none of them cares which one.
 * Responsibility: Carry the one call they make.
 * Boundary: Building and disposing the instrument belongs to the voice.
 */

export interface MelodyInstrument {
  triggerAttackRelease(
    frequencyHertz: number,
    duration: string | number,
    time: number,
    velocity: number,
  ): void;
}
