/**
 * Purpose: Name every voice the composition can call for and build it.
 * Context: The organ plays eight of the old instrument's voices; the rest of
 *   its collection did not survive the port because this composition never
 *   reaches for them.
 * Responsibility: Own the voice vocabulary and the one place a name becomes an
 *   audio graph.
 * Boundary: Each voice's sound lives in its own file; which voices a layer runs
 *   is authored in the composition.
 */

import type { Gain } from "tone";
import type { OrganHarmony } from "../organ-harmony";
import { type BassLoopSettings, createBassLoopVoice } from "./bass-loop-voice";
import { type ChoirVoiceSettings, createChoirVoice } from "./choir-voice";
import { createHiHatVoice, type HiHatSettings } from "./hi-hat-voice";
import type { OrganVoice } from "./organ-voice";
import {
  createPolyRhythmVoice,
  type PolyRhythmSettings,
} from "./poly-rhythm-voice";
import {
  createPressureWaveVoice,
  type PressureWaveSettings,
} from "./pressure-wave-voice";
import { createSonarVoice, type SonarVoiceSettings } from "./sonar-voice";
import { createWindVoice, type WindVoiceSettings } from "./wind-voice";
import { createWingBeatVoice, type WingBeatSettings } from "./wing-beat-voice";

/** One authored voice: its name and everything that voice alone understands. */
export type OrganVoiceSettings =
  | ({ readonly kind: "wind" } & WindVoiceSettings)
  | ({ readonly kind: "choir" } & ChoirVoiceSettings)
  | ({ readonly kind: "pressureWave" } & PressureWaveSettings)
  | ({ readonly kind: "wingBeat" } & WingBeatSettings)
  | ({ readonly kind: "polyRhythm" } & PolyRhythmSettings)
  | ({ readonly kind: "bassLoop" } & BassLoopSettings)
  | ({ readonly kind: "sonar" } & SonarVoiceSettings)
  | ({ readonly kind: "hiHat" } & HiHatSettings);

export function createOrganVoice(
  bus: Gain,
  harmony: OrganHarmony,
  settings: OrganVoiceSettings,
): OrganVoice {
  switch (settings.kind) {
    case "wind":
      return createWindVoice(bus, harmony, settings);
    case "choir":
      return createChoirVoice(bus, harmony, settings);
    case "pressureWave":
      return createPressureWaveVoice(bus, settings);
    case "wingBeat":
      return createWingBeatVoice(bus, settings);
    case "polyRhythm":
      return createPolyRhythmVoice(bus, settings);
    case "bassLoop":
      return createBassLoopVoice(bus, harmony, settings);
    case "sonar":
      return createSonarVoice(bus, settings);
    case "hiHat":
      return createHiHatVoice(bus, settings);
  }
}
