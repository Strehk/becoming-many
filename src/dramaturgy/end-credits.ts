/**
 * Purpose: Author the closing credit lines and answer how present they are.
 * Context: The piece returns to White World and needs a visible authored ending.
 * Responsibility: Own the credit content and the pure show-time presence ramp.
 * Boundary: Drawing, placement, and GPU resources belong to the credits module.
 */

import type { NarrationSchedule } from "./narration-schedule";

/**
 * How long the panel takes to reach full opacity from `creditsAtSeconds`.
 * Matches `SENSE_FADE_SECONDS` so the credits arrive on the same breath the
 * senses fade on, while staying tunable on their own.
 */
export const END_CREDITS_FADE_SECONDS = 4;

/**
 * What a line is, not how it is set. The module owns the type sizes; this
 * says only which kind of line each one is, so a name never has to be
 * recognised by comparing its text.
 */
export type EndCreditsLineRole = "title" | "role" | "name";

export interface EndCreditsLine {
  readonly role: EndCreditsLineRole;
  readonly text: string;
}

/** The ordered closing lines, drawn top to bottom on one panel. */
export interface EndCreditsDefinition {
  readonly lines: readonly EndCreditsLine[];
}

/**
 * The final credit copy. Audience-facing content, so it is authored once and
 * shown in both narration languages; names do not translate.
 */
export const END_CREDITS: EndCreditsDefinition = {
  lines: [
    { role: "title", text: "BECOMING MANY" },
    { role: "role", text: "A Project By" },
    { role: "name", text: "Erasmus Schmidt" },
    { role: "name", text: "Eddie Huesmann" },
    { role: "name", text: "Tade Strehk" },
  ],
};

/**
 * How present the credits are at a show time: 0 before they begin, ramping to
 * 1 across the fade, and 1 from there on — including while the show clock sits
 * clamped at the end, which is what holds the panel until staff restart. A
 * schedule that authors no credits time never shows them.
 *
 * Pure, like every other lookup in this folder, so a seek lands mid-fade
 * exactly where playing through would have and a seek to zero hides the panel.
 */
export function endCreditsPresenceAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): number {
  const atSeconds = schedule.creditsAtSeconds;
  if (atSeconds === undefined) return 0;

  const elapsedSeconds = showTimeSeconds - atSeconds;
  if (elapsedSeconds <= 0) return 0;
  if (elapsedSeconds >= END_CREDITS_FADE_SECONDS) return 1;

  return elapsedSeconds / END_CREDITS_FADE_SECONDS;
}
