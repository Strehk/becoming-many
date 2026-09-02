/**
 * Purpose: Own the drone organ's audio context, its shared chain, and its
 *   transport.
 * Context: Every voice mixes into one master chain and sends into one room, so
 *   the layers of the organ sound like one instrument rather than nine.
 * Responsibility: Build master, limiter, and reverb on Tone's own context,
 *   resume that context on a gesture, hold the resolved harmony, and follow the
 *   show's play state.
 * Boundary: Voices and their mix strips live beside this file; when the show
 *   plays is decided in `src/dramaturgy`.
 */

import {
  Frequency,
  Gain,
  getContext,
  getTransport,
  Limiter,
  Reverb,
  start,
} from "tone";
import type { OrganComposition } from "./drone-organ-settings";
import type { OrganHarmony } from "./organ-harmony";

export interface OrganEngine {
  /** Where every layer's dry output arrives. */
  readonly master: Gain;

  /** The one room all layers send into, post-fader. */
  readonly reverb: Reverb;

  readonly harmony: OrganHarmony;

  /**
   * Hold or resume the beat. Only the rhythmic voices ride the transport;
   * drones and wind keep breathing while the show stands still, which is what
   * a held rehearsal is supposed to sound like.
   */
  readonly setPlaying: (isPlaying: boolean) => void;

  readonly dispose: () => void;
}

/**
 * Build the organ on the context Tone made for itself, rather than on the one
 * the show's timebase owns. Sharing the show's context, which this port
 * first did, silently broke every voice's room: Tone reaches the audio
 * hardware through standardized-audio-context, whose AudioWorklet nodes only
 * come up on a context that library created. Measured on the built page, all
 * thirty-two comb filters of the four rooms failed to build, one unhandled
 * `InvalidStateError` each, and the rooms fell silent while the rest played on.
 *
 * The cost is a second `AudioContext` beside the timebase's. That one carries
 * no audio at all — it is the show's hardware clock — so nothing is mixed
 * across the two, and both resume on the same first gesture.
 */
export function createOrganEngine(composition: OrganComposition): OrganEngine {
  const releaseGesture = resumeOnGesture();

  // Master → limiter → speakers. The composition leaves the equalizer and the
  // master filter neutral and its delay silent, so neither is built: an unused
  // biquad still costs a headset frame budget it does not have to.
  const master = new Gain(composition.masterVolume);
  const limiter = new Limiter(-1);
  master.connect(limiter);
  limiter.toDestination();

  // One convolution room shared by every layer, addressed through each layer's
  // post-fader send. Tone renders the impulse response in the background; the
  // organ simply starts dry and grows its room a moment later.
  const reverb = new Reverb({
    decay: composition.room.decaySeconds,
    preDelay: composition.room.preDelaySeconds,
    wet: 1,
  });
  reverb.connect(master);

  const transport = getTransport();
  transport.bpm.value = composition.harmony.pulseBeatsPerMinute;
  let isRunning = false;

  return {
    master,
    reverb,

    harmony: {
      rootMidi: Frequency(composition.harmony.rootNote).toMidi(),
      scaleSemitones: composition.harmony.scaleSemitones,
    },

    setPlaying: (isPlaying): void => {
      if (isPlaying === isRunning) return;

      isRunning = isPlaying;
      if (isPlaying) transport.start();
      else transport.pause();
    },

    dispose: (): void => {
      releaseGesture();
      transport.stop();
      reverb.dispose();
      limiter.dispose();
      master.dispose();
    },
  };
}

/**
 * Tone's context starts suspended, exactly like the show's timebase, and only
 * a gesture in this window can start it. The listeners stay until the context
 * is genuinely running: one blocked attempt must not leave the organ silent
 * for the rest of the session.
 */
function resumeOnGesture(): () => void {
  const events = ["pointerdown", "keydown"] as const;

  function release(): void {
    for (const eventName of events)
      window.removeEventListener(eventName, resume);
  }

  function resume(): void {
    void start().then(
      () => {
        if (getContext().state === "running") release();
      },
      () => undefined,
    );
  }

  for (const eventName of events) window.addEventListener(eventName, resume);
  return release;
}
