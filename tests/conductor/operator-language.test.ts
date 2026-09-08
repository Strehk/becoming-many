/**
 * Purpose: Pin which language a station's page opens in.
 * Context: The choice is remembered per station browser; without one the
 *   browser's own language decides, so a German venue reads German unprompted.
 * Responsibility: Cover stored, offered, and unrecognised inputs.
 * Boundary: localStorage itself is the browser's, untested by design.
 */

import { describe, expect, test } from "bun:test";
import { resolveOperatorLanguage } from "../../src/conductor/operator-language";

describe("resolveOperatorLanguage", () => {
  test("takes the stored choice over the browser's", () => {
    expect(resolveOperatorLanguage("de", "en-GB")).toBe("de");
    expect(resolveOperatorLanguage("en", "de-DE")).toBe("en");
  });

  test("falls back to the browser's language", () => {
    expect(resolveOperatorLanguage(null, "de-AT")).toBe("de");
  });

  test("falls back to English for a language the page has no words for", () => {
    expect(resolveOperatorLanguage(null, "fr-CH")).toBe("en");
  });

  test("ignores a stored value the page cannot read", () => {
    expect(resolveOperatorLanguage("klingon", "de")).toBe("de");
  });

  test("opens in English knowing nothing at all", () => {
    expect(resolveOperatorLanguage(null, undefined)).toBe("en");
  });
});
