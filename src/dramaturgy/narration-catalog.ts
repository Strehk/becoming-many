/**
 * Purpose: Name every narration recording and resolve it to a served file.
 * Context: Cue times are shared between languages; only the audio files switch.
 * Responsibility: Own cue identity, recording lengths, and URL construction.
 * Boundary: When a cue plays is schedule data, not catalogue knowledge.
 */

/** Both languages ship; staff fix one when they arm a session. */
export const NARRATION_LANGUAGES = ["en", "de"] as const;

export type NarrationLanguage = (typeof NARRATION_LANGUAGES)[number];

const DEFAULT_NARRATION_LANGUAGE: NarrationLanguage = "en";

/** One narration recording as it ships under `public/audio/<language>/`. */
interface NarrationAsset {
  /** File name without its extension. */
  readonly fileStem: string;

  /**
   * Measured with ffprobe. A cue's slot is sized for the longer language, so
   * the player needs both lengths to know when a recording has run out.
   */
  readonly durationSeconds: Readonly<Record<NarrationLanguage, number>>;
}

/**
 * The script's nine sections (`script/README.md`) across eight recordings:
 * file 7 carries Finale and Overload as a single take, so nothing is
 * unrecorded. Reconstructed from delivery rate — sections 1-6 run at 78-96
 * words per minute in both languages, and only the merged reading of file 7
 * lands in that band (85.6 EN, 83.6 DE), where Finale alone would need an
 * implausible 32.5. Confirm by listening before the cue times are tuned.
 *
 * Cue ids reuse the sense vocabulary the levels already use, so a cue and the
 * sense it introduces are named the same thing.
 */
export const NARRATION_CUES = {
  prologue: { fileStem: "1", durationSeconds: { en: 72.37, de: 71.92 } },
  scent: { fileStem: "2", durationSeconds: { en: 45.0, de: 47.02 } },
  echo: { fileStem: "3", durationSeconds: { en: 27.01, de: 28.56 } },
  motion: { fileStem: "4", durationSeconds: { en: 49.46, de: 58.38 } },
  thermal: { fileStem: "5", durationSeconds: { en: 41.17, de: 44.63 } },
  magnetic: { fileStem: "6", durationSeconds: { en: 51.0, de: 49.51 } },
  finale: { fileStem: "7", durationSeconds: { en: 105.14, de: 106.89 } },
  return: { fileStem: "8", durationSeconds: { en: 69.56, de: 73.85 } },
} as const satisfies Record<string, NarrationAsset>;

export type NarrationCueId = keyof typeof NARRATION_CUES;

/** Falls back to the default rather than failing on an unknown request. */
export function resolveNarrationLanguage(
  requested: string | null,
): NarrationLanguage {
  const match = NARRATION_LANGUAGES.find((language) => language === requested);
  return match ?? DEFAULT_NARRATION_LANGUAGE;
}

/** Vite serves `public/audio` at `/audio/`. */
export function narrationUrl(
  cueId: NarrationCueId,
  language: NarrationLanguage,
): string {
  return `/audio/${language}/${NARRATION_CUES[cueId].fileStem}.mp3`;
}

/** How long this recording runs in the session's language. */
export function narrationDurationSeconds(
  cueId: NarrationCueId,
  language: NarrationLanguage,
): number {
  return NARRATION_CUES[cueId].durationSeconds[language];
}
