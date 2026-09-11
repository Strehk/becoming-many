import type { StartAudioSettings } from "./audio-contract";

/** Spatial FX raised twice by 20%; pad raised by 20% then 15%, retaining speech ducking. */
export const START_AUDIO_SETTINGS: StartAudioSettings = {
  sectionCapacity: 4,
  ringCapacity: 24,
  pulseDb: -26.83275,
  clickingDb: -40.83275,
  baseDb: -35.83275,
  padDb: -31.202418,
  padSpeakingDb: -43.202418,
  fadeSeconds: 0.6,
  clickingSources: 3,
  minimumDetuneCents: -2400,
  clickGrainSeconds: 0.12,
  clickOverlapSeconds: 0.04,
  baseHeads: 3,
  baseGrainSeconds: 0.8,
  baseOverlapSeconds: 0.35,
  ringRefDistance: 3,
  baseRefDistance: 15,
  rolloff: 1,
  reverbWet: 0.25,
  limiterDb: -6,
  reverbSeconds: 2.8,
  audiblePresence: 0.02,
  assetRoot: "/audio/tutorial/atmosphere/",
};
