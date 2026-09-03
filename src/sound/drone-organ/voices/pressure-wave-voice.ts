/**
 * Purpose: The pressure wave: a sub drone walking under a slow auto-filter.
 * Context: The magnetic world's floor — felt more than heard.
 * Responsibility: Build the two detuned oscillators, the wobble, and the drive.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { AutoFilter, Distortion, type Gain, Oscillator } from "tone";
import type { OrganVoice } from "./organ-voice";

/** The second oscillator sits slightly above the first; the beating is the wave. */
const DETUNE_RATIO = 1.005;

export interface PressureWaveSettings {
  readonly pressure: number; // 0..1 drive; how much the wave distorts.
  readonly waveDepth: number; // 0..1 octaves the auto-filter sweeps.
  readonly secondVoice: number; // 0..1 level of the detuned partner.
}

export function createPressureWaveVoice(
  bus: Gain,
  settings: PressureWaveSettings,
): OrganVoice {
  const lower = new Oscillator(55, "sine").start();
  lower.volume.value = -10;
  const upper = new Oscillator(55 * DETUNE_RATIO, "triangle").start();
  upper.volume.value = -16;
  const wobble = new AutoFilter({
    frequency: 0.12,
    baseFrequency: 45,
    octaves: 2.5,
    depth: 0.85,
  }).start();
  const drive = new Distortion(0.05);
  drive.wet.value = 0.2;

  lower.connect(wobble);
  upper.connect(wobble);
  wobble.chain(drive, bus);

  drive.distortion = settings.pressure * 0.6;
  drive.wet.rampTo(0.1 + settings.pressure * 0.6, 0.1);
  wobble.octaves = 1 + settings.waveDepth * 3.5;
  upper.volume.rampTo(-34 + settings.secondVoice * 26, 0.1);

  return {
    setPad: (x, y): void => {
      wobble.frequency.rampTo(0.03 + x * 1.8, 0.2);
      const baseHertz = 100 - y * 65;
      lower.frequency.rampTo(baseHertz, 0.5);
      upper.frequency.rampTo(baseHertz * DETUNE_RATIO, 0.5);
    },

    dispose: (): void => {
      for (const node of [lower, upper, wobble, drive]) node.dispose();
    },
  };
}
