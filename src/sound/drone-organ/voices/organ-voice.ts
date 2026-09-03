/**
 * Purpose: Name what every drone-organ voice offers the layer that holds it,
 *   and what the layer hands the voice to build with.
 * Context: A layer owns level, room send, cutoff, and placement; the voice owns
 *   the sound itself. Only the pad crosses between them while the show runs.
 * Responsibility: Carry the two calls a layer makes on its voice, and the
 *   context a voice is built in.
 * Boundary: How a voice makes its sound stays inside the voice.
 */

import type { OrganHarmony } from "../organ-harmony";
import type { OrganLane } from "../organ-timeline";

/** What a voice is built with, beyond its own authored settings. */
export interface VoiceContext {
  readonly harmony: OrganHarmony;

  /**
   * The layer's lane on the show's timeline. Every step a voice takes is
   * placed through it, which is what makes the show clock the only clock.
   */
  readonly lane: OrganLane;

  /** Separates this voice's hashed draws from every other layer's. */
  readonly salt: number;
}

export interface OrganVoice {
  /**
   * The voice's two-axis expression control, both axes 0..1. It is the only
   * input that moves per frame; everything else the composition fixes once.
   */
  setPad(x: number, y: number): void;

  dispose(): void;
}
