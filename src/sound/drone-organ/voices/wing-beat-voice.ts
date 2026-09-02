/**
 * Purpose: The wing beat: a band of noise opened and closed by a triangle flap,
 *   its rate re-diced in gusts.
 * Context: The motion world places two of these in space — one on the birds,
 *   one on the insects. It is the only voice the organ plays twice.
 * Responsibility: Build the air body, the flap, and the gusting rate.
 * Boundary: Where the voice sits in the world belongs to the layer.
 */

import { Filter, Gain, LFO, Loop, Noise } from "tone";
import type { OrganVoice } from "./organ-voice";

/** How often the flap rate is re-diced. Short enough to read as a creature. */
const GUST_INTERVAL_SECONDS = 0.42;

export interface WingBeatSettings {
  readonly gustiness: number; // 0..1 how far the flap rate is thrown per gust.
  readonly restingAir: number; // 0 closes the wing fully, 1 leaves it on the noise.
  readonly sharpness: number; // 0..1 resonance of the air body.
  readonly level: number; // 0..1 output level of the voice itself.
}

export function createWingBeatVoice(
  bus: Gain,
  settings: WingBeatSettings,
): OrganVoice {
  // Noise through a band-pass is the body of air a wing moves.
  const noise = new Noise("pink").start();
  const body = new Filter(900, "bandpass");
  body.Q.value = 2.4;
  const beat = new Gain(0);
  const output = new Gain(0.8);
  noise.chain(body, beat, output, bus);

  // Triangle, not square: a wing does not snap, it reaches out and comes back.
  const flap = new LFO({
    frequency: 9,
    min: 0,
    max: 1,
    type: "triangle",
  }).start();
  flap.connect(beat.gain);

  let flapHertz = 9;
  // The rate is re-diced in bursts rather than driven by a second LFO: a
  // signal connected to `flap.frequency` would take the parameter over, and
  // every later ramp on it would throw. A creature is not a sine wave anyway.
  const gust = new Loop(() => {
    const gusted =
      flapHertz * (1 + (Math.random() * 2 - 1) * settings.gustiness * 0.8);
    flap.frequency.rampTo(Math.max(1, gusted), 0.18);
  }, GUST_INTERVAL_SECONDS).start(0);

  flap.min = settings.restingAir * 0.6;
  body.Q.rampTo(0.5 + settings.sharpness * 12, 0.1);
  output.gain.rampTo(settings.level, 0.1);

  return {
    setPad: (x, y): void => {
      flapHertz = 3 + x * 21; // Three to twenty-four beats per second.
      flap.frequency.rampTo(flapHertz, 0.2);
      body.frequency.rampTo(300 + (1 - y) * 2600, 0.3); // Low reads as a big bird.
    },

    dispose: (): void => {
      gust.dispose();
      for (const node of [flap, noise, body, beat, output]) node.dispose();
    },
  };
}
