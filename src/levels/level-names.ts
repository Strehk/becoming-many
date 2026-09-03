/**
 * Purpose: Define the stable URL names of standalone levels.
 * Context: Browser and server entry routing must recognize levels without importing their presets.
 * Responsibility: Own level-name validation and path parsing.
 * Boundary: Presets and runtime resources live in the level catalog and runtime.
 */

export const LEVEL_NAMES = [
  "white-world",
  "scent",
  "echo",
  "motion",
  "thermal",
  "magnetic",
  "connections",
  "test",
  "design-test",
] as const;

export type LevelName = (typeof LEVEL_NAMES)[number];

const LEVEL_NAME_SET: ReadonlySet<string> = new Set(LEVEL_NAMES);

export function isLevelName(value: string): value is LevelName {
  return LEVEL_NAME_SET.has(value);
}

export function levelNameFromPath(pathname: string): LevelName | undefined {
  const candidate = pathname.replace(/^\/+|\/+$/g, "");
  return isLevelName(candidate) ? candidate : undefined;
}
