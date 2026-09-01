/**
 * Purpose: Verify the boundary between White World and the landscape Test Level.
 * Context: Terrain development must never silently become part of White World.
 * Responsibility: Lock the intended sparse Terrain activation into a regression test.
 * Boundary: Terrain rendering and landscape generation are tested separately.
 */

import { expect, test } from "bun:test";
import { level as connectionsLevel } from "../../src/levels/connections.level";
import { level as designTestLevel } from "../../src/levels/designTest.level";
import { level as echoLevel } from "../../src/levels/echo.level";
import type { LevelPreset } from "../../src/levels/level-runtime";
import { level as magneticLevel } from "../../src/levels/magnetic.level";
import { level as motionLevel } from "../../src/levels/motion.level";
import { level as scentLevel } from "../../src/levels/scent.level";
import { level as testLevel } from "../../src/levels/test.level";
import { level as thermalLevel } from "../../src/levels/thermal.level";
import { level as whiteWorld } from "../../src/levels/white-world.level";
import { THERMAL_PERCEPTION_SETTINGS } from "../../src/modules/thermal-perception/thermal-perception-settings";
import { WORLD_WIND } from "../../src/world/wind";

test("only the Test Level activates development diagnostics", () => {
  const testPreset: LevelPreset = testLevel;
  const whiteWorldPreset: LevelPreset = whiteWorld;

  expect(testPreset.terrain?.opacity).toBe(1);
  expect(testPreset.terrain?.presentation).toBe("zones");
  expect(testPreset.magnetic?.lineSpacingMeters).toBe(8);
  expect(testPreset.magnetic?.pulseWidthMeters).toBe(0.1);
  expect(testPreset.magnetic?.lineOpacity).toBe(0.2);
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
  expect(whiteWorldPreset.magnetic).toBeUndefined();
  expect(designTestLevel.magnetic).toBeUndefined();
  expect(scentLevel.magnetic).toBeUndefined();
  expect(echoLevel.magnetic).toBeUndefined();
  expect(motionLevel.magnetic).toBeUndefined();
  expect(thermalLevel.magnetic).toBeUndefined();
  expect(testPreset.connections).toBeUndefined();
  expect(whiteWorldPreset.connections).toBeUndefined();
  expect(designTestLevel.connections).toBeUndefined();
  expect(scentLevel.connections).toBeUndefined();
  expect(echoLevel.connections).toBeUndefined();
  expect(motionLevel.connections).toBeUndefined();
  expect(thermalLevel.connections).toBeUndefined();
  expect(magneticLevel.connections).toBeUndefined();
});

test("Echo Level renders depth through shared materials only", () => {
  const echoPreset: LevelPreset = echoLevel;
  // Grayscale versions of the level-03 palette luminance steps, with the two
  // far stops lifted above theirs so the horizon thins instead of ending in a
  // grey wall.
  const echoWorldPalette = [
    0x101010, 0x171717, 0x494949, 0x959595, 0xe2e2e2, 0xf7f7f7,
  ];
  const { echoDepth, terrain, vegetation, rocks } = echoPreset;
  if (!echoDepth || !terrain || !vegetation || !rocks) {
    throw new Error("Echo Level must author terrain, vegetation, and rocks");
  }

  expect(echoPreset.testUi).toBe(true);
  expect(terrain.opacity).toBe(1);
  expect(terrain.presentation).toBeUndefined();
  // Grass is parked while the heat view's per-fragment cost is unmeasured,
  // so no level from here down the narrative chain grows any.
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
  // The level departs from its moodboard's pale first stop and runs on the
  // white it is entered from, so the only colour in the world arrives
  // through the scent. The deviation is argued in the level README; this
  // pins it so restoring the stop has to read that first.
  expect(scentPreset.backgroundColor).toBe(0xffffff);
  expect(scentPreset.backgroundColor).toBe(whiteWorld.backgroundColor);
  expect(scentPreset.airParticles).toEqual(whiteWorld.airParticles);
  expect(scentPreset.invisibleGround).toBe(true);
  expect(scentPreset.terrain).toBeUndefined();
  expect(scentPreset.grass).toBeUndefined();
  expect(scentPreset.rocks).toBeUndefined();
  expect(scentPreset.animals).toBeUndefined();

  // Level 02 keeps every source object invisible, so its plants exist only
  // as the population the scent radiates from.
  expect(scentPreset.vegetation).toBeUndefined();
  expect(scentPreset.invisibleVegetation?.instancesPerHectareByZone).toEqual({
    meadow: 12,
    coniferForest: 150,
    deciduousForest: 150,
    shrubSlope: 70,
  });

  const scent = scentPreset.scentParticles;
  if (!scent) throw new Error("Scent Level must author the scent sense");

  // Every plant family and every animal species carries one signature:
  // plants take the cool half, animals the warm half. Only the two warm
  // animal stops are still the moodboard verbatim — the plant signatures
  // were deepened because the level's pale ones did not read as scent
  // against white. The deviation is argued in the level README; this pins
  // how far it has gone.
  const plantColors = Object.values(scent.plants).map(({ color }) => color);
  const animalColors = Object.values(scent.animals?.signatures ?? {}).map(
    ({ color }) => color,
  );
  expect(plantColors).toHaveLength(6);
  expect(animalColors).toHaveLength(4);
  expect(new Set([...plantColors, ...animalColors]).size).toBe(10);
  expect(
    [...plantColors, ...animalColors].filter((color) =>
      scentWorldPalette.includes(color),
    ),
  ).toHaveLength(2);

  for (const signature of Object.values(scent.plants)) {
    expect(signature.particlesPerPlant).toBeGreaterThan(0);
    expect(signature.emissionBottomFraction).toBeLessThan(
      signature.emissionTopFraction,
    );
    expect(signature.emissionTopFraction).toBeLessThanOrEqual(1);
    expect(signature.riseHeightMeters).toBeGreaterThan(0);
  }

  expect(scent.appearance.sizeMeters).toBe(0.24);
  expect(scent.motion.riseDurationSeconds).toBe(10);
  expect(scent.motion.speedMultiplier).toBe(1);
  // The wind has to beat the rise, or the scent only ever goes up and reads
  // as slow floating rather than as weather. This was authored the other way
  // round once — a tree lifted its scent four times further than the wind
  // carried it — so the relationship is pinned rather than the value.
  const carriedMetres = scent.motion.windResponseMeters * WORLD_WIND.strength;
  const tallestRise = Math.max(
    ...Object.values(scent.plants).map(
      ({ riseHeightMeters }) => riseHeightMeters,
    ),
  );
  expect(carriedMetres).toBeGreaterThan(tallestRise);
  // A route is carried much further still: nothing holds a print in place
  // once the animal has walked on.
  expect(scent.animals?.windResponseMeters ?? 0).toBeGreaterThan(
    scent.motion.windResponseMeters,
  );
  // The trail must stay inside the 60-second animation loop it ages against.
  expect(scent.animals?.lifetimeSeconds).toBeLessThanOrEqual(60);
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
  // The documented level-05 false-color palette, cold to hot. The warm three
  // are the moodboard colors verbatim. The cold three are carried down their
  // own hues and deviate in value only: the coldest reaches near-black so the
  // ramp has a dark floor for shadowed crown depths, cold hollows, and deep
  // water, and the two above it are deepened so the landscape they cover
  // reads dark rather than lit from within. Hue is what is pinned here — a
  // change that drains the cold end toward grey is the reverted experiment
  // and must fail this test.
  const thermalPalette = [
    0x0e0628, 0x072b7d, 0x1c6c8b, 0xd5198a, 0xfb5f16, 0xfcce43,
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
  // The ground is held in violet, blue, and cyan by where the ramp's warm
  // stop sits, not by draining its colors: no matter how a ground reading
  // adds up, its own substance stops below the warmth at which magenta is
  // reached. Rock shares that range, so it is checked with the ground.
  for (const coldBand of [thermal.bands.terrain, thermal.bands.rocks]) {
    expect(coldBand.ceilingWarmth).toBeLessThan(
      THERMAL_PERCEPTION_SETTINGS.warmStopFraction,
    );
  }
  // Only a living body reaches the top of the ramp.
  expect(thermal.bands.animals.floorWarmth).toBeGreaterThan(
    thermal.bands.terrain.ceilingWarmth,
  );
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

test("Magnetic Level layers the field onto the carried Thermal world", () => {
  const magneticPreset: LevelPreset = magneticLevel;
  // The documented level-06 moodboard palette.
  const magneticPalette = [
    0x151935, 0x1140a4, 0x69bde1, 0xcddbe2, 0xa394c3, 0xf9b33c,
  ];
  const { magnetic } = magneticPreset;
  if (!magnetic) {
    throw new Error("Magnetic Level must author the magnetic sense");
  }

  expect(magneticPreset.testUi).toBe(true);
  // Senses layer, never swap: every thermal-world layer carries over unchanged.
  expect(magneticPreset.airParticles).toEqual(thermalLevel.airParticles);
  expect(magneticPreset.scentParticles).toEqual(thermalLevel.scentParticles);
  expect(magneticPreset.echoDepth).toEqual(thermalLevel.echoDepth);
  expect(magneticPreset.terrain).toEqual(thermalLevel.terrain);
  expect(magneticPreset.vegetation).toEqual(thermalLevel.vegetation);
  expect(magneticPreset.rocks).toEqual(thermalLevel.rocks);
  expect(magneticPreset.animals).toEqual(thermalLevel.animals);
  expect(magneticPreset.motion).toEqual(thermalLevel.motion);
  expect(magneticPreset.thermal).toEqual(thermalLevel.thermal);
  expect(magneticPreset.backgroundColor).toBe(
    thermalLevel.backgroundColor ?? -1,
  );
  expect(magneticPreset.grass).toBeUndefined();
  expect(magneticPreset.invisibleGround).toBeUndefined();

  expect(magnetic.intensity).toBe(1);
  // The pulse travels strictly inside its line between separated lines.
  expect(magnetic.pulseWidthMeters).toBeLessThan(magnetic.lineWidthMeters);
  expect(magnetic.lineWidthMeters).toBeLessThan(magnetic.lineSpacingMeters);
  expect(magnetic.lineOpacity).toBeGreaterThan(0);
  expect(magnetic.lineOpacity).toBeLessThanOrEqual(1);
  // Deep blue carries line and sky glow; the pale stop carries the pulse.
  for (const color of Object.values(magnetic.colors)) {
    expect(magneticPalette).toContain(color);
  }
  expect(magnetic.colors.skyGlowColor).toBe(magnetic.colors.lineColor);
});

test("Connections Level layers the web onto the carried Magnetic world", () => {
  const connectionsPreset: LevelPreset = connectionsLevel;
  // The documented level-07 moodboard palette.
  const connectionsPalette = [
    0xf2e3d3, 0x683b5a, 0x292e55, 0xa5bdc3, 0xd06780, 0xe39e54,
  ];
  const { connections } = connectionsPreset;
  if (!connections) {
    throw new Error("Connections Level must author the connections sense");
  }

  expect(connectionsPreset.testUi).toBe(true);
  // Senses layer, never swap: every magnetic-world layer carries over unchanged.
  expect(connectionsPreset.airParticles).toEqual(magneticLevel.airParticles);
  expect(connectionsPreset.scentParticles).toEqual(
    magneticLevel.scentParticles,
  );
  expect(connectionsPreset.echoDepth).toEqual(magneticLevel.echoDepth);
  expect(connectionsPreset.terrain).toEqual(magneticLevel.terrain);
  expect(connectionsPreset.vegetation).toEqual(magneticLevel.vegetation);
  expect(connectionsPreset.rocks).toEqual(magneticLevel.rocks);
  expect(connectionsPreset.animals).toEqual(magneticLevel.animals);
  expect(connectionsPreset.motion).toEqual(magneticLevel.motion);
  expect(connectionsPreset.thermal).toEqual(magneticLevel.thermal);
  expect(connectionsPreset.magnetic).toEqual(magneticLevel.magnetic);
  expect(connectionsPreset.backgroundColor).toBe(
    magneticLevel.backgroundColor ?? -1,
  );
  expect(connectionsPreset.grass).toBeUndefined();
  expect(connectionsPreset.invisibleGround).toBeUndefined();

  expect(connections.intensity).toBe(1);
  // The web reaches far past the thermal radius while staying inside the
  // echo far distance, so strands never pop at the haze boundary.
  expect(connections.webRadiusMeters).toBeGreaterThan(
    connectionsPreset.thermal?.radiusMeters ?? Number.POSITIVE_INFINITY,
  );
  expect(connections.webRadiusMeters).toBeLessThan(
    connectionsPreset.echoDepth?.farDistanceMeters ?? 0,
  );
  // Nutrient pulses travel slower than the carried magnetic signal pulses.
  expect(connections.pulseSpeedMetersPerSecond).toBeLessThan(
    connectionsPreset.magnetic?.flowSpeedMetersPerSecond ?? 0,
  );
  // All four world-element classes participate, each with a palette color.
  const sources = Object.values(connections.sources);
  expect(sources).toHaveLength(4);
  for (const source of sources) {
    expect(connectionsPalette).toContain(source.nodeColor);
    expect(source.weight).toBeGreaterThan(0);
    expect(source.weight).toBeLessThanOrEqual(1);
  }
  // The pulse stays a palette stop; the depth tone is a free tuning value
  // (currently white, lightening the cord midpoints).
  expect(connectionsPalette).toContain(connections.colors.pulseColor);
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
