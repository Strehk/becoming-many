/**
 * Purpose: Verify effective level contents and authored values.
 * Context: Every level explicitly selects its modules; Show uses the Connections recipe.
 * Responsibility: Preserve world membership and content relationships without requiring shared objects.
 * Boundary: Runtime construction and rendering are tested separately.
 */

import { expect, test } from "bun:test";
import { level as connectionsLevel } from "../../src/levels/connections.level";
import { level as diagnosticLevel } from "../../src/levels/diagnostic.level";
import { level as echoLevel } from "../../src/levels/echo.level";
import { LEVEL_CATALOG } from "../../src/levels/level-catalog";
import type {
  LevelPreset,
  WorldComposition,
} from "../../src/levels/level-preset";
import { level as magneticLevel } from "../../src/levels/magnetic.level";
import { level as motionLevel } from "../../src/levels/motion.level";
import { level as scentLevel } from "../../src/levels/scent.level";
import { level as thermalLevel } from "../../src/levels/thermal.level";
import { level as visualIntegrationLevel } from "../../src/levels/visual-integration.level";
import { level as whiteWorld } from "../../src/levels/white-world.level";
import { MYCELIUM_SETTINGS } from "../../src/modules/mycelium/mycelium-settings";
import { THERMAL_PERCEPTION_SETTINGS } from "../../src/modules/thermal-perception/thermal-perception-settings";
import { BASE_CHUNK_SIZE } from "../../src/world/chunk-system";
import { WORLD_WIND } from "../../src/world/wind";

// @ts-expect-error A world cannot request visible and invisible vegetation together.
const invalidVegetation: WorldComposition = {
  vegetation: echoLevel.vegetation,
  invisibleVegetation: scentLevel.invisibleVegetation,
};
void invalidVegetation;

test("every level authors the current terrain-relative flight ceiling", () => {
  for (const preset of Object.values(LEVEL_CATALOG)) {
    expect(preset.maximumGroundClearanceMeters).toBe(50);
  }
});

test("each world component appears only in its intended levels", () => {
  const expectedLevels = [
    ["start", "start"],
    [
      "airParticles",
      "start white-world scent echo motion thermal magnetic connections diagnostic visual-integration",
    ],
    ["invisibleGround", "scent"],
    ["invisibleVegetation", "scent"],
    ["scentParticles", "scent echo motion thermal magnetic connections"],
    ["echoDepth", "echo motion thermal magnetic connections"],
    [
      "terrain",
      "echo motion thermal magnetic connections diagnostic visual-integration",
    ],
    [
      "grassClipmap",
      "echo motion thermal magnetic connections diagnostic visual-integration",
    ],
    [
      "vegetation",
      "echo motion thermal magnetic connections diagnostic visual-integration",
    ],
    [
      "rocks",
      "echo motion thermal magnetic connections diagnostic visual-integration",
    ],
    ["motion", "motion thermal magnetic connections"],
    ["animals", "thermal magnetic connections diagnostic visual-integration"],
    ["thermal", "thermal magnetic connections"],
    ["magnetic", "magnetic connections diagnostic"],
    ["connections", "connections"],
  ] as const;

  for (const [component, expected] of expectedLevels) {
    const configuredLevels = Object.entries(LEVEL_CATALOG)
      .filter(([, level]) => level[component] !== undefined)
      .map(([name]) => name);
    expect(configuredLevels.sort()).toEqual(expected.split(" ").sort());
  }
});

test("Diagnostic owns its world values independently", () => {
  const diagnosticPreset: LevelPreset = diagnosticLevel;
  const whiteWorldPreset: LevelPreset = whiteWorld;

  expect(diagnosticPreset.terrain?.opacity).toBe(1);
  expect(diagnosticPreset.terrain?.presentation).toBe("zones");
  expect(diagnosticPreset.magnetic?.fieldElevationDegrees).toBe(7.5);
  expect(diagnosticPreset.magnetic?.colors.northColor).toBe(0xd97819);
  expect(diagnosticPreset.grassClipmap?.tuftsPerSquareMeter).toBe(1.5);
  expect(diagnosticPreset.grassClipmap?.bladeHeightMeters).toBe(0.75);
  expect(diagnosticPreset.vegetation?.instancesPerHectareByZone).toEqual({
    meadow: 12,
    coniferForest: 150,
    deciduousForest: 150,
    shrubSlope: 70,
  });
  expect(diagnosticPreset.rocks?.instancesPerHectareByZone).toEqual({
    meadow: 8,
    coniferForest: 10,
    deciduousForest: 10,
    shrubSlope: 60,
  });
  expect(diagnosticPreset.animals?.colors.featureColor).toBe(0x292929);
  expect(diagnosticPreset.airParticles).not.toEqual(
    whiteWorldPreset.airParticles,
  );
});

test("Echo Level owns a complete depth-world startup recipe", () => {
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

  expect(terrain.opacity).toBe(1);
  expect(terrain.presentation).toBeUndefined();
  expect(echoPreset.grassClipmap?.tuftsPerSquareMeter).toBeGreaterThan(0);
  expect(echoPreset.grassClipmap?.bladeHeightMeters).toBeGreaterThan(0);
  // The blades author no look of their own beyond a base gradient: the
  // senses take their color, exactly as they take every other surface.
  expect(echoPreset.grassClipmap?.colors.rootColor).toBeDefined();

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

test("Scent Level owns its complete invisible source world", () => {
  const scentPreset: LevelPreset = scentLevel;
  const scentWorldPalette = [
    0xf6eee0, 0xb8e0e1, 0x9dd2c8, 0xd1c1d7, 0xfda39d, 0xfdbb54,
  ];

  // The level departs from its moodboard's pale first stop and runs on the
  // white it is entered from, so the only colour in the world arrives
  // through the scent. The deviation is argued in the level README; this
  // pins it so restoring the stop has to read that first.
  expect(scentPreset.backgroundColor).toBe(0xffffff);
  expect(scentPreset.backgroundColor).toBe(whiteWorld.backgroundColor);
  expect(scentPreset.airParticles).toEqual(whiteWorld.airParticles);
  expect(scentPreset.invisibleGround).toBe(true);

  // The unseen plants stand exactly where Echo will later show them, so a
  // trail a traveler follows in Scent rises from a plant they can see later.
  expect(scentPreset.invisibleVegetation?.instancesPerHectareByZone).toEqual(
    echoLevel.vegetation?.instancesPerHectareByZone,
  );

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

  expect(scent.appearance.sizeMeters).toBe(0.16);
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
  // A route is carried less far than airborne plant scent, and never nothing:
  // a print clings to the ground it was left on, so the weather leans a trail
  // instead of moving it off the ground the animal actually walked. Carried
  // further than the plants, as it was authored once, the trail stopped being
  // something a traveler could follow at all.
  const trailCarriedMetres = scent.animals?.windResponseMeters ?? 0;
  expect(trailCarriedMetres).toBeGreaterThan(0);
  expect(trailCarriedMetres).toBeLessThan(scent.motion.windResponseMeters);
  // The trail must stay inside the 60-second animation loop it ages against.
  expect(scent.animals?.lifetimeSeconds).toBeLessThanOrEqual(60);
});

test("Motion Level owns its complete motion-world startup recipe", () => {
  const motionPreset: LevelPreset = motionLevel;
  // The dark stops of the level-04 moodboard palette color the motion actors.
  const motionDarkStops = [0x212133, 0x312758, 0x45577a];
  const { motion } = motionPreset;
  if (!motion) throw new Error("Motion Level must author the motion sense");

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

test("Thermal Level owns its complete heat-world startup recipe", () => {
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

  // A bird is a warm body, so the heat view prints its trace in the palette's
  // hot stop instead of the cold accent the pale world reads it as. The
  // cold-blooded flies keep their own colors: a swarm printed warm would be
  // the level's brightest untruth.
  const thermalMotion = thermalPreset.motion;
  if (!thermalMotion?.birds) throw new Error("Thermal Level must carry birds");
  expect(thermalMotion.birds.appearance.trailColor).toBe(
    thermal.colors.hotColor,
  );
  expect(thermalMotion.appearance.flyColor).not.toBe(thermal.colors.hotColor);
  expect(thermalMotion.birds.appearance.trailColor).not.toBe(
    motionLevel.motion?.birds?.appearance.trailColor,
  );

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
  // Grass reads as the ground it grows out of, not as the bushes standing in
  // it: carrying vegetation's values made a whole meadow one flat hot surface.
  expect(thermal.surfaces.grassWarmth).toBeLessThan(
    thermal.surfaces.vegetationWarmth,
  );
  expect(thermal.surfaces.grassWarmth).toBeLessThanOrEqual(
    thermal.bands.terrain.ceilingWarmth,
  );
  expect(thermal.bands.grass.ceilingWarmth).toBeLessThan(
    thermal.bands.vegetation.ceilingWarmth,
  );
  // A bush is read from the meadow it stands in upward, not from the canopy
  // down: warmer than the grass around it, cooler than the plants that carry
  // a crown, and never able to reach the magenta a stem is allowed. Under the
  // canopy's values it was the one thing in the landscape holding a single
  // warm color across its whole body, because a plant sheds its warmth over
  // its own metres and a bush has too few to shed any.
  expect(thermal.surfaces.undergrowthWarmth).toBeGreaterThan(
    thermal.surfaces.grassWarmth,
  );
  expect(thermal.surfaces.undergrowthWarmth).toBeLessThan(
    thermal.surfaces.vegetationWarmth,
  );
  expect(thermal.bands.undergrowth.ceilingWarmth).toBeGreaterThan(
    thermal.bands.grass.ceilingWarmth,
  );
  expect(thermal.bands.undergrowth.ceilingWarmth).toBeLessThan(
    THERMAL_PERCEPTION_SETTINGS.warmStopFraction,
  );

  // Animals outside the radius sit inside the carried echo grayscale.
  const echoWorldPalette = [0x101010, 0x171717, 0x494949];
  for (const color of Object.values(animals.colors)) {
    expect(echoWorldPalette).toContain(color);
  }
});

test("Magnetic Level owns its complete field-world startup recipe", () => {
  const magneticPreset: LevelPreset = magneticLevel;
  const { magnetic } = magneticPreset;
  if (!magnetic) {
    throw new Error("Magnetic Level must author the magnetic sense");
  }

  expect(magnetic.intensity).toBe(1);
  // The field axis: north as authored, tilted above the horizon so the
  // shimmer patch sits in the sky rather than in the ground.
  expect(magnetic.fieldDirectionDegreesFromNorth).toBe(0);
  expect(magnetic.fieldElevationDegrees).toBeGreaterThan(0);
  expect(magnetic.fieldElevationDegrees).toBeLessThan(90);
  // The previous version's authored pole colors, ported verbatim: the northern
  // patch reads dark against the pale sky, the southern one dissolves in it.
  // They sit outside the level-06 moodboard by decision, not by oversight.
  expect(magnetic.colors.northColor).toBe(0x000000);
  expect(magnetic.colors.southColor).toBe(0xffffff);
  expect(magnetic.colors.zenithColor).toBe(0xc4d7f6);
});

test("Connections Level owns its complete connected-world startup recipe", () => {
  const connectionsPreset: LevelPreset = connectionsLevel;
  // The documented level-07 moodboard palette.
  const connectionsPalette = [
    0xf2e3d3, 0x683b5a, 0x292e55, 0xa5bdc3, 0xd06780, 0xe39e54,
  ];
  const { connections } = connectionsPreset;
  if (!connections) {
    throw new Error("Connections Level must author the connections sense");
  }

  expect(connections.intensity).toBe(1);
  // Reach before density: the root mat is carried at the experiment's density,
  // which a horizon-wide web cannot afford, so it stays an intimate zone the
  // visitor walks inside. It still ends well inside the echo haze, so strands
  // never pop at the haze boundary.
  expect(connections.webRadiusMeters).toBeLessThanOrEqual(
    MYCELIUM_SETTINGS.buildChunkRadius * BASE_CHUNK_SIZE,
  );
  expect(connections.webRadiusMeters).toBeLessThan(
    connectionsPreset.echoDepth?.farDistanceMeters ?? 0,
  );
  // Nutrients crawl: one pulse needs well over ten seconds to cross the web,
  // against the magnetic pulses sweeping the sky overhead.
  expect(
    connections.webRadiusMeters / connections.pulseSpeedMetersPerSecond,
  ).toBeGreaterThan(10);
  // Three standing world-element classes participate beside the seeded soil
  // mat, each with a palette color. Animals are deliberately absent: a root
  // system is what stands still and grows, and a body walking over it is not
  // part of it.
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

test("Visual integration authors semantic colors without diagnostics", () => {
  expect(visualIntegrationLevel.terrain?.colors).toEqual({
    lowElevationColor: 0x51417d,
    highElevationColor: 0xc3c5d1,
    waterColor: 0x9bdedb,
  });
  expect(visualIntegrationLevel.terrain?.presentation).toBeUndefined();
  expect(visualIntegrationLevel.grassClipmap?.colors.rootColor).toBe(0x49328b);
  expect(visualIntegrationLevel.grassClipmap?.colors.tipColor).toBe(0x67d6ad);
  expect(visualIntegrationLevel.vegetation?.colors.trunkColor).toBe(0x51447b);
  expect(visualIntegrationLevel.rocks?.colors.lightColor).toBe(0x739fa8);
  expect(visualIntegrationLevel.animals?.colors.furColor).toBe(0xf3d34f);
});
