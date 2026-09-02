/**
 * Purpose: The wind: filtered noise in gusts, with a slow sine pad walking the
 *   world scale behind it.
 * Context: The organ's one ungated voice — it carries the empty world before
 *   any sense has been introduced.
 * Responsibility: Build the noise, its gusting band-pass, the pad, and the walk.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { Filter, Gain, LFO, Noise, PolySynth, Synth } from "tone";
import type { OrganHarmony } from "../organ-harmony";
import type { OrganVoice } from "./organ-voice";
import { createScaleWalk } from "./scale-walk";

export interface WindVoiceSettings {
  readonly gustRate: number; // 0..1 how quickly gusts come and go.
  readonly sharpness: number; // 0..1 resonance of the noise band.
  readonly padLevel: number; // 0..1 volume of the sung pad under the noise.
  readonly gustDepth: number; // 0 holds the wind steady, 1 lets it gust fully.
  readonly melodyDensity: number; // 0..1 how often the pad takes a step.
}

export function createWindVoice(
  bus: Gain,
  harmony: OrganHarmony,
  settings: WindVoiceSettings,
): OrganVoice {
  const noise = new Noise("pink").start();
  const band = new Filter(600, "bandpass");
  band.Q.value = 1.4;
  const noiseLevel = new Gain(0.4);
  noise.chain(band, noiseLevel, bus);

  // The gust is an LFO on the band's centre rather than on its level: what
  // makes wind readable is the colour moving, not the volume.
  const gust = new LFO(0.08, 300, 900).start();
  gust.connect(band.frequency);

  const pad = new PolySynth(Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 2.5, decay: 1, sustain: 0.6, release: 6 },
    volume: -12,
  });
  pad.maxPolyphony = 4;
  pad.connect(bus);

  gust.frequency.rampTo(0.02 + settings.gustRate * 0.9, 0.2);
  band.Q.rampTo(0.3 + settings.sharpness * 10, 0.1);
  pad.volume.rampTo(-30 + settings.padLevel * 24, 0.1);
  gust.amplitude.rampTo(settings.gustDepth, 0.2);

  const walk = createScaleWalk(harmony, {
    instrument: pad,
    interval: "2n",
    noteDuration: "1n",
    baseOctave: 2,
    octaves: 2,
    velocity: 0.45,
    density: settings.melodyDensity,
  });

  return {
    setPad: (x, y): void => {
      const centreHertz = 200 + x * 2400;
      gust.min = centreHertz * 0.6;
      gust.max = centreHertz * 1.7;
      noiseLevel.gain.rampTo(0.04 + y * 0.75, 0.1);
    },

    dispose: (): void => {
      walk.dispose();
      for (const node of [noise, band, noiseLevel, gust, pad]) node.dispose();
    },
  };
}
