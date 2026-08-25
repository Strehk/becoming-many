/**
 * Purpose: Verify the boundary between White World and the landscape Test Level.
 * Context: Terrain development must never silently become part of White World.
 * Responsibility: Lock the intended sparse Terrain activation into a regression test.
 * Boundary: Terrain rendering and landscape generation are tested separately.
 */

import { expect, test } from "bun:test";
import { level as designTestLevel } from "../../src/levels/designTest.level";
import type { LevelPreset } from "../../src/levels/level-runtime";
import { level as scentLevel } from "../../src/levels/scent.level";
import { level as testLevel } from "../../src/levels/test.level";
import { level as whiteWorld } from "../../src/levels/white-world.level";

test("only the Test Level activates development diagnostics", () => {
  const testPreset: LevelPreset = testLevel;
  const whiteWorldPreset: LevelPreset = whiteWorld;

  expect(testPreset.terrain?.opacity).toBe(1);
  expect(testPreset.terrain?.presentation).toBe("zones");
  expect(testPreset.terrain?.magneticSense?.lineSpacingMeters).toBe(8);
  expect(testPreset.terrain?.magneticSense?.pulseWidthMeters).toBe(0.1);
  expect(testPreset.terrain?.magneticSense?.lineOpacity).toBe(0.2);
  expect(testPreset.grass?.zones.meadow).toEqual({
    tuftsPerSquareMeter: 1.5,
    bladeHeightMeters: 0.75,
  });
  expect(testPreset.grass?.zones.shrubSlope).toEqual({
    tuftsPerSquareMeter: 0.4,
    bladeHeightMeters: 0.22,
  });
  expect(testPreset.vegetation?.instancesPerHectareByZone).toEqual({
    meadow: 12,
    coniferForest: 150,
    deciduousForest: 150,
    shrubSlope: 70,
  });
  expect(testPreset.rocks?.instancesPerHectareByZone).toEqual({
    meadow: 8,
    coniferForest: 10,
    deciduousForest: 10,
    shrubSlope: 60,
  });
  expect(testPreset.animals?.colors.featureColor).toBe(0x292929);
  expect(testPreset.testUi).toBe(true);
  expect(whiteWorldPreset.terrain).toBeUndefined();
  expect(whiteWorldPreset.vegetation).toBeUndefined();
  expect(whiteWorldPreset.rocks).toBeUndefined();
  expect(whiteWorldPreset.animals).toBeUndefined();
  expect(whiteWorldPreset.testUi).toBeUndefined();
  expect(whiteWorldPreset.scentParticles).toBeUndefined();
  expect(whiteWorldPreset.invisibleGround).toBeUndefined();
  expect(testPreset.scentParticles).toBeUndefined();
  expect(designTestLevel.scentParticles).toBeUndefined();
});

test("Scent Level layers scent onto the White World air baseline", () => {
  const scentPreset: LevelPreset = scentLevel;
  const scentWorldPalette = [
    0xf6eee0, 0xb8e0e1, 0x9dd2c8, 0xd1c1d7, 0xfda39d, 0xfdbb54,
  ];

  expect(scentPreset.testUi).toBe(true);
  expect(scentPreset.airParticles).toEqual(whiteWorld.airParticles);
  expect(scentPreset.invisibleGround).toBe(true);
  expect(scentPreset.terrain).toBeUndefined();
  expect(scentPreset.grass).toBeUndefined();
  expect(scentPreset.vegetation).toBeUndefined();
  expect(scentPreset.rocks).toBeUndefined();
  expect(scentPreset.animals).toBeUndefined();

  for (const color of scentPreset.scentParticles?.colors ?? []) {
    expect(scentWorldPalette).toContain(color);
  }
  expect(scentPreset.scentParticles?.colors).toHaveLength(5);
  expect(scentPreset.scentParticles?.placement).toEqual({
    emittersPerChunk: 2,
    minHeightMeters: 1,
    maxHeightMeters: 2,
  });
  expect(scentPreset.scentParticles?.emission).toEqual({
    particlesPerEmitter: 192,
    cloudRadiusMeters: 3,
    cloudHeightMeters: 1,
  });
  expect(scentPreset.scentParticles?.appearance.sizeMeters).toBe(0.15);
  expect(scentPreset.scentParticles?.motion).toEqual({
    riseHeightMeters: 1.5,
    riseDurationSeconds: 10,
    driftAmplitudeMeters: 0.4,
    speedMultiplier: 1,
  });
});

test("Design Test authors semantic colors without development diagnostics", () => {
  expect(designTestLevel.terrain?.colors).toEqual({
    lowElevationColor: 0x51417d,
    highElevationColor: 0xc3c5d1,
    waterColor: 0x9bdedb,
  });
  expect(designTestLevel.terrain?.presentation).toBeUndefined();
  expect(designTestLevel.grass?.rootColor).toBe(0x49328b);
  expect(designTestLevel.grass?.tipColor).toBe(0x67d6ad);
  expect(designTestLevel.vegetation?.colors.trunkColor).toBe(0x51447b);
  expect(designTestLevel.rocks?.colors.lightColor).toBe(0x739fa8);
  expect(designTestLevel.animals?.colors.furColor).toBe(0xf3d34f);
});
