/**
 * Purpose: Decide which language this station's page is read in, and remember it.
 * Context: The venue, not the piece, decides who runs the station: the choice
 *   belongs to the browser on the station's monitor, like the M5 host does.
 * Responsibility: Resolve a stored or offered language to one the page has,
 *   and carry it across page loads.
 * Boundary: The words themselves live in the conductor copy; arming a
 *   visitor's narration language is a different choice entirely.
 */

import { OPERATOR_LANGUAGES, type OperatorLanguage } from "./conductor-copy";

// A technician's choice for this station's browser, not authored
// configuration — hence localStorage, like the M5 host beside it.
const STORAGE_KEY = "bm-conductor-language";

const DEFAULT_OPERATOR_LANGUAGE: OperatorLanguage = "en";

/**
 * The stored choice wins; without one the browser's own language decides, so
 * a German station reads German before anybody opens the drawer. Anything
 * unrecognised falls back to English rather than to an empty page.
 */
export function resolveOperatorLanguage(
  stored: string | null,
  offered: string | undefined,
): OperatorLanguage {
  return (
    matchOperatorLanguage(stored) ??
    matchOperatorLanguage(offered) ??
    DEFAULT_OPERATOR_LANGUAGE
  );
}

/** A tag like "de-AT" is German; anything the page has no words for is not. */
function matchOperatorLanguage(
  tag: string | null | undefined,
): OperatorLanguage | undefined {
  if (!tag) return undefined;

  const primary = tag.trim().toLowerCase().split("-")[0];

  return OPERATOR_LANGUAGES.find((language) => language === primary);
}

/** Reads the station browser's choice. Private mode is not a failure here. */
export function loadOperatorLanguage(): OperatorLanguage {
  try {
    return resolveOperatorLanguage(
      localStorage.getItem(STORAGE_KEY),
      navigator.language,
    );
  } catch {
    return DEFAULT_OPERATOR_LANGUAGE;
  }
}

export function saveOperatorLanguage(language: OperatorLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // A browser that refuses storage still switches for this session.
  }
}
