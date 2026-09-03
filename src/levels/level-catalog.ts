/**
 * Purpose: Name every level preset so a run can select one at startup.
 * Context: Benchmarking and review need any level, not only the entry default.
 * Responsibility: Map stable level names to presets and resolve a requested name.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { level as connectionsLevel } from "./connections.level";
import { level as designTestLevel } from "./designTest.level";
import { level as echoLevel } from "./echo.level";
import { isLevelName, LEVEL_NAMES, type LevelName } from "./level-names";
import type { LevelPreset } from "./level-preset";
import { level as magneticLevel } from "./magnetic.level";
import { level as motionLevel } from "./motion.level";
import { level as scentLevel } from "./scent.level";
import { level as testLevel } from "./test.level";
import { level as thermalLevel } from "./thermal.level";
import { level as whiteWorldLevel } from "./white-world.level";

/** Narrative order first, diagnostic presets last. */
export const LEVEL_CATALOG = {
  "white-world": whiteWorldLevel,
  scent: scentLevel,
  echo: echoLevel,
  motion: motionLevel,
  thermal: thermalLevel,
  magnetic: magneticLevel,
  connections: connectionsLevel,
  test: testLevel,
  "design-test": designTestLevel,
} as const satisfies Record<LevelName, LevelPreset>;

export { isLevelName, LEVEL_NAMES, type LevelName } from "./level-names";

/** The level the browser entry opens without an explicit request. */
const DEFAULT_LEVEL_NAME: LevelName = "connections";

/** Falls back to the default rather than failing on an unknown request. */
export function resolveLevelName(requested: string | null): LevelName {
  if (requested === null) return DEFAULT_LEVEL_NAME;
  if (isLevelName(requested)) return requested;

  // A misspelled name used to open the default level without a word, and the
  // default is the last level of the chain — so a typo silently answered with
  // every sense at once. Falling back is still right, because a bad URL must
  // not leave a black screen, but it has to say so.
  console.warn(
    `Unknown level "${requested}". Opening "${DEFAULT_LEVEL_NAME}" instead. ` +
      `Known levels: ${LEVEL_NAMES.join(", ")}.`,
  );
  return DEFAULT_LEVEL_NAME;
}
