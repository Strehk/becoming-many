/**
 * Purpose: Verify loading of concrete modules owned by the Test entry.
 * Context: The show bundle must not import Zone Visualizer.
 * Responsibility: Load Zone Visualizer only for its diagnostic terrain presentation.
 * Boundary: Module behavior remains covered by its own module tests.
 */

import { expect, test } from "bun:test";
import { loadTestLevelModules } from "../../src/entry/test-level-modules";
import { level as designTestLevel } from "../../src/levels/designTest.level";
import { level as testLevel } from "../../src/levels/test.level";
import { level as whiteWorldLevel } from "../../src/levels/white-world.level";

test("loads no Zone Visualizer without its terrain presentation", async () => {
  for (const preset of [whiteWorldLevel, designTestLevel]) {
    expect(await loadTestLevelModules(preset)).toEqual({
      createZonePresentation: undefined,
    });
  }
});

test("loads Zone Visualizer for the diagnostic Test preset", async () => {
  const modules = await loadTestLevelModules(testLevel);

  expect(modules.createZonePresentation).toBeFunction();
});
