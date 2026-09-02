/**
 * Purpose: The choir: breathing chord surfaces that turn through a fixed
 *   progression, with a pink-noise breath under them.
 * Context: The voice the scent world opens with — the one layer of the organ
 *   that sings rather than sounds.
 * Responsibility: Build the pad, its breath, and the chord cycle that plays it.
 * Boundary: Level, room send, cutoff, and placement belong to the layer.
 */

import { Filter, Frequency, Gain, Noise, PolySynth, Synth } from "tone";
import type { OrganHarmony } from "../organ-harmony";
import { createChordCycle } from "./chord-cycle";
import type { OrganVoice } from "./organ-voice";

/** How long a chord change holds its swell, and how far its notes fan out. */
const SWELL_SECONDS = 6;
const SWELL_SPREAD_SECONDS = 0.15;
const SWELL_VELOCITY = 0.4;

export interface ChoirVoiceSettings {
  readonly breath: number; // 0..1 how much noise breathes under the chords.
  readonly fullness: number; // 0 sings one octave, 1 doubles it.
  readonly brightness: number; // 0..1 opens the pad's low-pass.
  readonly melodyDensity: number; // 0..1 how often a chord tone is sung.
  readonly chordSeconds: number; // How long one chord holds.
}

export function createChoirVoice(
  bus: Gain,
  harmony: OrganHarmony,
  settings: ChoirVoiceSettings,
): OrganVoice {
  const pad = new PolySynth(Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 2.2, decay: 1, sustain: 0.7, release: 6 },
    volume: -14,
  });
  pad.maxPolyphony = 12;
  const lowPass = new Filter(2500, "lowpass");
  pad.chain(lowPass, bus);

  const breath = new Noise("pink").start();
  const breathBand = new Filter(900, "bandpass");
  const breathLevel = new Gain(0);
  breath.chain(breathBand, breathLevel, bus);

  breathLevel.gain.rampTo(settings.breath * 0.25, 0.1);
  lowPass.frequency.rampTo(800 + settings.brightness * 5200, 0.2);

  const cycle = createChordCycle(harmony, {
    instrument: pad,
    interval: "2n",
    noteDuration: "1n",
    baseOctave: 2,
    octaves: 1 + Math.round(settings.fullness),
    velocity: 0.3,
    density: settings.melodyDensity,
    chordSeconds: settings.chordSeconds,

    // Every chord change is itself a breath: the whole chord swells in, its
    // notes fanned out just enough to arrive as voices rather than as a block.
    onChordChange: (midiNotes, time): void => {
      midiNotes.forEach((midi, index) => {
        pad.triggerAttackRelease(
          Frequency(midi, "midi").toFrequency(),
          SWELL_SECONDS,
          time + index * SWELL_SPREAD_SECONDS,
          SWELL_VELOCITY,
        );
      });
    },
  });

  return {
    setPad: (x, y): void => {
      // Softness is the envelope itself: the slower it opens and closes, the
      // less the chord is sung and the more it simply appears.
      pad.set({ envelope: { attack: 0.4 + x * 4.5, release: 3 + x * 6 } });
      cycle.setBaseOctave(1 + Math.round(y * 2));
    },

    dispose: (): void => {
      cycle.dispose();
      for (const node of [pad, lowPass, breath, breathBand, breathLevel]) {
        node.dispose();
      }
    },
  };
}
