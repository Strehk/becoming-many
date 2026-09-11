/** English recording cues and opening staging; Start owns selection and playback.
 * German defaults remain in start-exercises.ts. Word alignment is approximate;
 * provenance and measured durations are documented in start-audio-transcript.md.
 */
import type { ExerciseVoiceCue, StartSequence } from "./start-contract";

export const ENGLISH_START_VOICES = {
  right: {
    url: "/audio/tutorial/en/introduction-right.wav",
    durationSeconds: 18.174938,
    instructionAtSeconds: 17.16,
  },
  left: {
    url: "/audio/tutorial/en/left.wav",
    durationSeconds: 3.002396,
    instructionAtSeconds: 1.36,
  },
  up: {
    url: "/audio/tutorial/en/up.wav",
    durationSeconds: 3.507542,
    instructionAtSeconds: 2.38,
  },
  down: {
    url: "/audio/tutorial/en/down.wav",
    durationSeconds: 2.102063,
    instructionAtSeconds: 0.66,
  },
  complete: {
    url: "/audio/tutorial/en/complete.wav",
    durationSeconds: 13.297396,
    instructionAtSeconds: 0,
  },
} as const satisfies Record<string, ExerciseVoiceCue>;

// At 2 m/s, preserve the German approach's remaining distance at the turn cue.
export const ENGLISH_START_OPENING = {
  approachMeters: 18.48,
  pathAtSeconds: 8,
  pathFadeSeconds: 3.2,
  worldReveal: { atSeconds: 12.94, fadeSeconds: 3.2 },
} as const satisfies StartSequence;
