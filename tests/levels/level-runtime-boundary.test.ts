/**
 * Purpose: Keep Level Runtime independent from concrete content construction.
 * Context: Level Composition is the one owner of module factories and asset definitions.
 * Responsibility: Guard the import boundary established by issue #57.
 * Boundary: Runtime behavior remains covered by module tests and browser smoke tests.
 */

import { expect, test } from "bun:test";

test("Level Runtime delegates concrete world construction", async () => {
  const runtimeSource = await Bun.file(
    new URL("../../src/levels/level-runtime.ts", import.meta.url),
  ).text();

  expect(runtimeSource).toContain('from "./level-composition"');
  expect(runtimeSource).not.toMatch(/from "\.\.\/modules\//);
  expect(runtimeSource).not.toContain("-definition");
});

test("Level Composition takes authored passages through the composition", async () => {
  const compositionSource = await Bun.file(
    new URL("../../src/levels/level-composition.ts", import.meta.url),
  ).text();

  // Which animals cross is composition data like every other authored block:
  // it arrives on `ShowComposition`, so this file reaches for neither the
  // piece's schedule nor a module's own definitions to find it.
  expect(compositionSource).not.toContain("piece-schedule");
  expect(compositionSource).not.toContain("passage-definitions");
});
