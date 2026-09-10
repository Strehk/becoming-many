/**
 * Purpose: Own the drone organ's shared audio chain.
 * Context: Every voice mixes into one master chain and sends into one room, so
 *   the layers of the organ sound like one instrument rather than nine.
 * Responsibility: Build master, limiter, and reverb on Tone's own context,
 *   and hold the resolved harmony. Run owns the shared context and audio wake.
 * Boundary: Voices and their mix strips live beside this file; time is the
 *   show clock's, carried in through the organ's timeline — the engine keeps
 *   no transport.
 */

import {
  type Context,
  Frequency,
  Gain,
  Limiter,
  Reverb,
  type ToneAudioNode,
} from "tone";
import type { OrganComposition } from "./drone-organ-settings";
import type { OrganHarmony } from "./organ-harmony";

export interface OrganEngine {
  /** Where every layer's dry output arrives. */
  readonly master: Gain;

  /** The one room all layers send into, post-fader. */
  readonly reverb: Reverb;

  readonly harmony: OrganHarmony;

  readonly unload: () => Promise<void>;
}

/**
 * Borrow the Run's Tone-created context. The native Show clock context broke
 * the rooms' AudioWorklets in Chromium; that compatibility evidence and the
 * two owners are recorded in docs/architecture.md.
 */
export async function createOrganEngine(
  composition: OrganComposition,
  pulseSeconds: number,
  context: Context,
): Promise<OrganEngine> {
  const nodes: ToneAudioNode[] = [];
  let reverb: Reverb | undefined;
  async function unload(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await reverb?.ready;
    } catch (error) {
      errors.push(error);
    }
    for (const node of nodes.reverse()) {
      try {
        node.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Organ engine cleanup failed");
  }

  try {
    // Master → limiter → speakers. The composition leaves the equalizer and the
    // master filter neutral and its delay silent, so neither is built: an unused
    // biquad still costs a headset frame budget it does not have to.
    const master = new Gain({ context, gain: composition.masterVolume });
    nodes.push(master);
    const limiter = new Limiter({ context, threshold: -1 });
    nodes.push(limiter);
    master.connect(limiter);
    limiter.toDestination();

    // One convolution room shared by every layer, addressed through each layer's
    // post-fader send. Tone renders the impulse response in the background; the
    // organ simply starts dry and grows its room a moment later.
    reverb = new Reverb({
      context,
      decay: composition.room.decaySeconds,
      preDelay: composition.room.preDelaySeconds,
      wet: 1,
    });
    nodes.push(reverb);
    reverb.connect(master);

    return {
      master,
      reverb,

      harmony: {
        rootMidi: Frequency(composition.harmony.rootNote).toMidi(),
        scaleSemitones: composition.harmony.scaleSemitones,
        pulseSeconds,
      },

      unload,
    };
  } catch (error) {
    try {
      await unload();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Organ engine startup failed",
      );
    }
    throw error;
  }
}
