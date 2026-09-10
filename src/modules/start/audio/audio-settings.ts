import type { StartAudioSettings } from "./audio-contract";

/** Quiet spatial accents; the narrator remains the foreground voice. */
export const START_AUDIO_SETTINGS: StartAudioSettings = {
  sectionCapacity: 4,
  ringCapacity: 24,
  pulseDb: -34,
  clickingDb: -48,
  baseDb: -43,
  padDb: -38,
  padSpeakingDb: -50,
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
