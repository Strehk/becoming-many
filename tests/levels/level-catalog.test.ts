/**
 * Purpose: Verify how a run selects the level it opens.
 * Context: The level comes from a URL, where a typo is the ordinary case.
 * Responsibility: Cover the known names, the fallback, and that it says so.
 * Boundary: Level content is checked in level-presets.test.ts.
 */

import { expect, test } from "bun:test";
import {
  isLevelName,
  LEVEL_NAMES,
  resolveLevelName,
} from "../../src/levels/level-catalog";

test("every catalog name resolves to itself", () => {
  for (const name of LEVEL_NAMES) {
    expect(resolveLevelName(name)).toBe(name);
    expect(isLevelName(name)).toBe(true);
  }
});

test("no request opens the default without a word", () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => warnings.push(message);

  // The bare page plays the piece; asking for nothing is not a mistake.
  expect(LEVEL_NAMES).toContain(resolveLevelName(null));
  expect(warnings).toHaveLength(0);

  console.warn = original;
});

test("an unknown level falls back loudly", () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => warnings.push(message);

  // Falling back is right — a bad URL must not leave a black screen — but a
  // silent fallback answered a typo with the last level of the chain, which
  // carries every sense at once.
  const resolved = resolveLevelName("deph");
  console.warn = original;

  expect(LEVEL_NAMES).toContain(resolved);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('Unknown level "deph"');
  for (const name of LEVEL_NAMES) expect(warnings[0]).toContain(name);
});
