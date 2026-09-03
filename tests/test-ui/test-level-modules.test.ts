/**
 * Purpose: Verify loading of concrete modules owned by the Test entry.
 * Context: The show bundle must not import legacy Grass or Zone Visualizer.
 * Responsibility: Cover absent, Grass-only, and full diagnostic module requests.
 * Boundary: Module behavior remains covered by its own module tests.
 */

import { expect, test } from "bun:test";
import { level as designTestLevel } from "../../src/levels/designTest.level";
import { level as testLevel } from "../../src/levels/test.level";
import { level as whiteWorldLevel } from "../../src/levels/white-world.level";
import { loadTestLevelModules } from "../../src/test-ui/test-level-modules";

test("loads no diagnostic module for a preset that requests none", async () => {
  expect(await loadTestLevelModules(whiteWorldLevel)).toEqual({
    createLegacyGrass: undefined,
    createZonePresentation: undefined,
  });
});

test("loads only legacy Grass for a visual-design preset", async () => {
  const modules = await loadTestLevelModules(designTestLevel);

  expect(modules.createLegacyGrass).toBeFunction();
  expect(modules.createZonePresentation).toBeUndefined();
});

test("loads every module required by the diagnostic Test preset", async () => {
  const modules = await loadTestLevelModules(testLevel);

  expect(modules.createLegacyGrass).toBeFunction();
  expect(modules.createZonePresentation).toBeFunction();
});
