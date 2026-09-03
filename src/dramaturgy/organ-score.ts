/**
 * Purpose: Say which voices of the drone organ each world state carries, and
 *   how strongly a voice sounds at a show time.
 * Context: The organ is generative — nothing it plays is written down — so
 *   what the piece composes is which voices are heard, when, and to what pulse.
 *   That is dramaturgy, exactly as the sense ladder is.
 * Responsibility: Own the voice vocabulary, the score, the pulse, and the pure
 *   strength lookup.
 * Boundary: How a voice sounds lives in `src/sound/drone-organ`; the organ
 *   never reads the schedule and this folder never imports the organ.
 */

import type { NarrationSchedule, ShowLevelName } from "./narration-schedule";
import { rampValueAt } from "./show-levels";

/** Every voice the organ can play, named after what it is heard as. */
export type OrganVoiceName =
  | "wind"
  | "choir"
  | "sonar"
  | "birdWingBeat"
  | "insectWingBeat"
  | "bassLoop"
  | "pressureWave"
  | "polyRhythm"
  | "hiHat";

export const ORGAN_VOICES: readonly OrganVoiceName[] = [
  "wind",
  "choir",
  "sonar",
  "birdWingBeat",
  "insectWingBeat",
  "bassLoop",
  "pressureWave",
  "polyRhythm",
  "hiHat",
];

export interface OrganScore {
  /**
   * One beat of the organ's common pulse, in show seconds. Every rhythmic
   * voice steps on a fraction or multiple of it, so the layers lock without a
   * transport of their own: a step's time is a pure function of show time.
   */
  readonly pulseSeconds: number;

  /** The voices each world state carries. Voices layer; none is swapped out. */
  readonly voices: Record<ShowLevelName, readonly OrganVoiceName[]>;
}

/**
 * The composed score. It follows the ladder: each world adds its voice on top
 * of the ones already sounding, and the wind carries the empty world before
 * any sense has been introduced. The return to White World puts every voice
 * but the wind away again.
 */
export const ORGAN_SCORE: OrganScore = {
  pulseSeconds: 60 / 54, // Fifty-four beats per minute: slow, and shared.
  voices: {
    "white-world": ["wind"],
    scent: ["wind", "choir"],
    echo: ["wind", "choir", "sonar"],
    motion: ["wind", "choir", "sonar", "birdWingBeat", "insectWingBeat"],
    thermal: [
      "wind",
      "choir",
      "sonar",
      "birdWingBeat",
      "insectWingBeat",
      "bassLoop",
    ],
    magnetic: [
      "wind",
      "choir",
      "sonar",
      "birdWingBeat",
      "insectWingBeat",
      "bassLoop",
      "pressureWave",
    ],
    connections: ORGAN_VOICES,
  },
};

/**
 * One voice's strength at a show time, in 0..1, on the same ramp a sense
 * fades on: each cue boundary sets a target of one when the cue's world
 * carries the voice and zero when it does not, and the strength moves there
 * linearly over the shared fade. Derived from the schedule and the instant,
 * never accumulated, so a seek lands mid-fade where playing through would.
 */
export function organVoiceStrengthAt(
  schedule: NarrationSchedule,
  score: OrganScore,
  voice: OrganVoiceName,
  showTimeSeconds: number,
): number {
  // The show opens silent; the first cue's boundary raises the opening voices.
  let rampStartSeconds = 0;
  let rampStartValue = 0;
  let rampTarget = 0;

  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;

    rampStartValue = rampValueAt(
      rampStartSeconds,
      rampStartValue,
      rampTarget,
      cue.atSeconds,
    );
    rampStartSeconds = cue.atSeconds;
    rampTarget = score.voices[cue.level].includes(voice) ? 1 : 0;
  }

  return rampValueAt(
    rampStartSeconds,
    rampStartValue,
    rampTarget,
    showTimeSeconds,
  );
}
