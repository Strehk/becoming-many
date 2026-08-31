/**
 * Purpose: Name every level preset so a run can select one at startup.
 * Context: Benchmarking and review need any level, not only the entry default.
 * Responsibility: Map stable level names to presets and resolve a requested name.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { level as connectionsLevel } from "./connections.level";
import { level as designTestLevel } from "./designTest.level";
import { level as echoLevel } from "./echo.level";
import type { LevelPreset } from "./level-runtime";
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
} as const satisfies Record<string, LevelPreset>;

export type LevelName = keyof typeof LEVEL_CATALOG;

/** The level the browser entry opens without an explicit request. */
const DEFAULT_LEVEL_NAME: LevelName = "connections";

export const LEVEL_NAMES = Object.keys(LEVEL_CATALOG) as readonly LevelName[];

export function isLevelName(value: string): value is LevelName {
  return value in LEVEL_CATALOG;
}

/** Falls back to the default rather than failing on an unknown request. */
export function resolveLevelName(requested: string | null): LevelName {
  return requested !== null && isLevelName(requested)
    ? requested
    : DEFAULT_LEVEL_NAME;
}
