/**
 * Purpose: Name what every drone-organ voice offers the layer that holds it.
 * Context: A layer owns level, room send, cutoff, and placement; the voice owns
 *   the sound itself. Only the pad crosses between them while the show runs.
 * Responsibility: Carry the two calls a layer makes on its voice.
 * Boundary: How a voice makes its sound stays inside the voice.
 */

export interface OrganVoice {
  /**
   * The voice's two-axis expression control, both axes 0..1. It is the only
   * input that moves per frame; everything else the composition fixes once.
   */
  setPad(x: number, y: number): void;

  dispose(): void;
}
