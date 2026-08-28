/**
 * Purpose: Verify the boundary between White World and the landscape Test Level.
 * Context: Terrain development must never silently become part of White World.
 * Responsibility: Lock the intended sparse Terrain activation into a regression test.
 * Boundary: Terrain rendering and landscape generation are tested separately.
 */

import { expect, test } from "bun:test";
import { level as designTestLevel } from "../../src/levels/designTest.level";
import { level as echoLevel } from "../../src/levels/echo.level";
import type { LevelPreset } from "../../src/levels/level-runtime";
import { level as motionLevel } from "../../src/levels/motion.level";
import { level as scentLevel } from "../../src/levels/scent.level";
import { level as testLevel } from "../../src/levels/test.level";
import { level as thermalLevel } from "../../src/levels/thermal.level";
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
  expect(testPreset.echoDepth).toBeUndefined();
  expect(whiteWorldPreset.echoDepth).toBeUndefined();
  expect(designTestLevel.echoDepth).toBeUndefined();
  expect(scentLevel.echoDepth).toBeUndefined();
  expect(testPreset.motion).toBeUndefined();
  expect(whiteWorldPreset.motion).toBeUndefined();
  expect(designTestLevel.motion).toBeUndefined();
  expect(scentLevel.motion).toBeUndefined();
  expect(echoLevel.motion).toBeUndefined();
  expect(testPreset.thermal).toBeUndefined();
  expect(whiteWorldPreset.thermal).toBeUndefined();
  expect(designTestLevel.thermal).toBeUndefined();
  expect(scentLevel.thermal).toBeUndefined();
  expect(echoLevel.thermal).toBeUndefined();
  expect(motionLevel.thermal).toBeUndefined();
});

test("Echo Level renders depth through shared materials only", () => {
  const echoPreset: LevelPreset = echoLevel;
  // Grayscale versions of the level-03 palette luminance steps.
  const echoWorldPalette = [
    0x101010, 0x171717, 0x494949, 0x959595, 0xd7d7d7, 0xf1f1f1,
  ];
  const { echoDepth, terrain, vegetation, rocks } = echoPreset;
  if (!echoDepth || !terrain || !vegetation || !rocks) {
    throw new Error("Echo Level must author terrain, vegetation, and rocks");
  }

  expect(echoPreset.testUi).toBe(true);
  expect(terrain.opacity).toBe(1);
  expect(terrain.presentation).toBeUndefined();
  expect(terrain.magneticSense).toBeUndefined();
  expect(echoPreset.grass).toBeUndefined();
  expect(echoPreset.animals).toBeUndefined();
  // Senses layer, never swap: the air and scent layers carry over unchanged.
  expect(echoPreset.airParticles).toEqual(whiteWorld.airParticles);
  expect(echoPreset.scentParticles).toEqual(scentLevel.scentParticles);
  expect(echoPreset.invisibleGround).toBeUndefined();

  expect(echoDepth.intensity).toBe(1);
  expect(echoDepth.nearDistanceMeters).toBeLessThan(
    echoDepth.farDistanceMeters,
  );
  expect(echoDepth.farDistanceMeters).toBeLessThan(
    echoPreset.viewDistance ?? 0,
  );
  expect(echoPreset.backgroundColor).toBe(echoDepth.colors.hazeColor);

  const authoredColors = [
    ...Object.values(echoDepth.colors),
    ...Object.values(vegetation.colors),
    ...Object.values(rocks.colors),
  ];
  expect(
    authoredColors.every((color) => echoWorldPalette.includes(color)),
  ).toBe(true);
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

test("Motion Level layers fly swarms onto the carried Echo world", () => {
  const motionPreset: LevelPreset = motionLevel;
  // The dark stops of the level-04 moodboard palette color the motion actors.
  const motionDarkStops = [0x212133, 0x312758, 0x45577a];
  const { motion } = motionPreset;
  if (!motion) throw new Error("Motion Level must author the motion sense");

  expect(motionPreset.testUi).toBe(true);
  // Senses layer, never swap: every echo-world layer carries over unchanged.
  expect(motionPreset.airParticles).toEqual(echoLevel.airParticles);
  expect(motionPreset.scentParticles).toEqual(echoLevel.scentParticles);
  expect(motionPreset.echoDepth).toEqual(echoLevel.echoDepth);
  expect(motionPreset.terrain).toEqual(echoLevel.terrain);
  expect(motionPreset.vegetation).toEqual(echoLevel.vegetation);
  expect(motionPreset.rocks).toEqual(echoLevel.rocks);
  expect(motionPreset.backgroundColor).toBe(echoLevel.backgroundColor ?? -1);
  expect(motionPreset.grass).toBeUndefined();
  expect(motionPreset.animals).toBeUndefined();
  expect(motionPreset.invisibleGround).toBeUndefined();

  expect(motion.intensity).toBe(1);
  expect(motion.swarms.swarmCount).toBeGreaterThan(0);
  expect(motion.swarms.fliesPerSwarm).toBeGreaterThan(0);
  expect(motionDarkStops).toContain(motion.appearance.flyColor);
  expect(motionDarkStops).toContain(motion.appearance.trailColor);
  expect(motion.trail.lifetimeFrames).toBeGreaterThan(1);
  expect(motion.trail.density).toBeGreaterThan(0);
  expect(motion.trail.density).toBeLessThanOrEqual(1);

  // Bird traces use the cyan accent reserved for them in the 04 palette.
  expect(motion.birds?.appearance.trailColor).toBe(0x10bedb);
  expect(motion.birds?.flockCount).toBeGreaterThan(0);
  expect(motion.birds?.birdsPerFlock).toBeGreaterThan(0);
  expect(motion.birds?.flightHeightMeters).toBeGreaterThan(0);
});

test("Thermal Level layers heat onto the carried Motion world", () => {
  const thermalPreset: LevelPreset = thermalLevel;
  // The documented level-05 false-color palette, cold to hot.
  const thermalPalette = [
    0x2e1386, 0x0c47d1, 0x2eb4e8, 0xd5198a, 0xfb5f16, 0xfcce43,
  ];
  const { thermal, animals } = thermalPreset;
  if (!thermal) throw new Error("Thermal Level must author the thermal sense");
  if (!animals) throw new Error("Thermal Level must author warm animals");

  expect(thermalPreset.testUi).toBe(true);
  // Senses layer, never swap: every motion-world layer carries over unchanged.
  expect(thermalPreset.airParticles).toEqual(motionLevel.airParticles);
  expect(thermalPreset.scentParticles).toEqual(motionLevel.scentParticles);
  expect(thermalPreset.echoDepth).toEqual(motionLevel.echoDepth);
  expect(thermalPreset.terrain).toEqual(motionLevel.terrain);
  expect(thermalPreset.vegetation).toEqual(motionLevel.vegetation);
  expect(thermalPreset.rocks).toEqual(motionLevel.rocks);
  expect(thermalPreset.motion).toEqual(motionLevel.motion);
  expect(thermalPreset.backgroundColor).toBe(motionLevel.backgroundColor ?? -1);
  expect(thermalPreset.grass).toBeUndefined();
  expect(thermalPreset.invisibleGround).toBeUndefined();

  expect(thermal.intensity).toBe(1);
  expect(Object.values(thermal.colors)).toEqual(thermalPalette);
  // Heat is a near sense: it feathers out well inside the echo far distance.
  expect(thermal.edgeFeatherMeters).toBeLessThan(thermal.radiusMeters);
  expect(thermal.radiusMeters + thermal.edgeFeatherMeters).toBeLessThan(
    thermalPreset.echoDepth?.farDistanceMeters ?? 0,
  );
  // Living bodies outrank every static surface warmth.
  expect(thermal.actorWarmth).toBeGreaterThan(
    thermal.surfaces.vegetationWarmth,
  );
  expect(thermal.actorWarmth).toBeGreaterThan(thermal.surfaces.rockWarmth);

  // Animals outside the radius sit inside the carried echo grayscale.
  const echoWorldPalette = [0x101010, 0x171717, 0x494949];
  for (const color of Object.values(animals.colors)) {
    expect(echoWorldPalette).toContain(color);
  }
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
