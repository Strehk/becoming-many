/**
 * Purpose: Verify the shared material decoration produced by Thermal Perception.
 * Context: One heat view must decorate Terrain, Vegetation, Rocks, Grass, and Animals alike.
 * Responsibility: Cover parameter wiring, shader injection, effect ordering, the warmth budget, and validation.
 * Boundary: Visual ramp quality and physical PICO performance require runtime acceptance.
 */

import { expect, test } from "bun:test";
import { Color, MeshBasicMaterial, type Vector2, Vector4 } from "three";
import { createEchoDepth } from "../../src/modules/echo-depth/echo-depth";
import {
  createThermalPerception,
  type ThermalPerceptionParameters,
} from "../../src/modules/thermal-perception/thermal-perception";
import {
  THERMAL_GROUND_HEAT_SOURCE_COUNT,
  THERMAL_PERCEPTION_SETTINGS,
} from "../../src/modules/thermal-perception/thermal-perception-settings";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const DEER_HEIGHT_METERS = 1.4;

const PARAMETERS: ThermalPerceptionParameters = {
  intensity: 1,
  radiusMeters: 30,
  edgeFeatherMeters: 10,
  colors: {
    coldestColor: 0x2e1386,
    coldColor: 0x0c47d1,
    coolColor: 0x2eb4e8,
    warmColor: 0xd5198a,
    hotColor: 0xfb5f16,
    hottestColor: 0xfcce43,
  },
  surfaces: {
    vegetationWarmth: 0.44,
    vegetationWarmthSpread: 0.14,
    rockWarmth: 0.31,
    rockWarmthSpread: 0.11,
  },
  actorWarmth: 0.95,
};

test("Thermal Perception injects the radius-bounded ramp into both stages", () => {
  const effects = createThermalEffects();
  const material = new MeshBasicMaterial();
  effects.terrain.applyTo(material);
  const shader = createBasicShaderSource();

  material.onBeforeCompile(shader, undefined as never);

  expect(shader.vertexShader).toContain("passThermalPerception(mvPosition)");
  expect(shader.vertexShader).toContain("attribute float thermalWarmth");
  expect(shader.fragmentShader).toContain(
    "applyThermalPerception(diffuseColor.rgb)",
  );
  expect(shader.uniforms.thermalIntensity?.value).toBe(1);
  expect(shader.uniforms.thermalRadiusMeters?.value).toBe(30);
  expect(shader.uniforms.thermalEdgeFeatherMeters?.value).toBe(10);
});

test("Thermal Perception carries the palette anchors in gamma space", () => {
  // The ramp interpolates in gamma space and squares the result back, so the
  // uniforms hold the square root of each authored anchor. The anchors
  // themselves must survive that round trip exactly; only the path between two
  // of them changes, and that path is where the intermediate temperatures are.
  const shader = compileEffect(createThermalEffects().terrain);
  const coldest = shader.uniforms.thermalColdestColor?.value as Color;
  const hottest = shader.uniforms.thermalHottestColor?.value as Color;

  expect(squareColor(coldest).getHex()).toBe(0x2e1386);
  expect(squareColor(hottest).getHex()).toBe(0xfcce43);
});

test("Thermal Perception fades the cold end out to the carried world", () => {
  // The cold end of the ramp is not a color at all: below the first stop the
  // heat view is transparent and the echo depth map shows through untouched,
  // so warmth reads as a highlight inside the depth world rather than as an
  // image replacing it.
  const shader = compileEffect(createThermalEffects().terrain);
  const { transparentBelowWarmth, opaqueAboveWarmth } =
    THERMAL_PERCEPTION_SETTINGS.ramp;
  const visibility = shader.uniforms.thermalHeatVisibility?.value as Vector2;

  expect(visibility.x).toBe(transparentBelowWarmth);
  expect(visibility.y).toBe(opaqueAboveWarmth);
  // It multiplies the radius feather rather than replacing it: one fade bounds
  // the sense in space, the other in temperature.
  expect(shader.fragmentShader).toContain(
    "senseReach * thermalIntensity * heatVisibility",
  );

  // Water is the coldest thing in the world and must carry no false color at
  // all, while every part of a living body stays fully opaque — the fade
  // belongs to the cold end, and a body must never read as half-there.
  expect(transparentBelowWarmth).toBeGreaterThan(
    THERMAL_PERCEPTION_SETTINGS.terrainWarmth.shorelineWarmth,
  );
  expect(opaqueAboveWarmth).toBeLessThanOrEqual(
    THERMAL_PERCEPTION_SETTINGS.environmentCeiling.ceilingWarmth,
  );
});

test("Thermal Perception gives each consumer its own warmth source", () => {
  const effects = createThermalEffects();
  const vegetationShader = compileEffect(effects.vegetation);
  const rocksShader = compileEffect(effects.rocks);
  const animalsShader = compileActorEffect(effects.animals);

  expect(vegetationShader.vertexShader).toContain("thermalInstanceHash");
  expect(vegetationShader.uniforms.thermalBaseWarmth?.value).toBe(0.44);
  expect(vegetationShader.uniforms.thermalWarmthSpread?.value).toBe(0.14);
  expect(rocksShader.uniforms.thermalBaseWarmth?.value).toBe(0.31);
  expect(rocksShader.uniforms.thermalWarmthSpread?.value).toBe(0.11);
  expect(animalsShader.vertexShader).toContain("thermalActorWarmth");
  expect(animalsShader.uniforms.thermalActorWarmth?.value).toBe(0.95);
});

test("Thermal Perception shares one uniform set across all variants", () => {
  const effects = createThermalEffects();
  const terrainShader = compileEffect(effects.terrain);
  const vegetationShader = compileEffect(effects.vegetation);
  const animalsShader = compileActorEffect(effects.animals);

  expect(terrainShader.uniforms.thermalIntensity).toBe(
    vegetationShader.uniforms.thermalIntensity as never,
  );
  expect(terrainShader.uniforms.thermalIntensity).toBe(
    animalsShader.uniforms.thermalIntensity as never,
  );
});

test("Thermal Perception keeps one program per consumer geometry kind", () => {
  const effects = createThermalEffects();
  const terrain = new MeshBasicMaterial();
  const vegetation = new MeshBasicMaterial();
  const rocks = new MeshBasicMaterial();
  const animals = new MeshBasicMaterial();
  effects.terrain.applyTo(terrain);
  effects.vegetation.applyTo(vegetation);
  effects.rocks.applyTo(rocks);
  effects.animals.applyTo(animals, DEER_HEIGHT_METERS);

  expect(terrain.customProgramCacheKey()).toEndWith(":thermal-terrain-v2");
  expect(vegetation.customProgramCacheKey()).toEndWith(":thermal-instanced-v2");
  expect(rocks.customProgramCacheKey()).toEndWith(":thermal-instanced-v2");
  expect(animals.customProgramCacheKey()).toEndWith(":thermal-actor-v2");
});

test("Thermal Perception wins the final color over a carried echo ramp", () => {
  // First-applied executes last (see material-shader-patch): the composition
  // root pushes thermal before echo, so echo's line must land before
  // thermal's in the compiled fragment body.
  const effects = createThermalEffects();
  const echoDepth = createEchoDepth({
    intensity: 1,
    nearDistanceMeters: 6,
    farDistanceMeters: 120,
    colors: {
      nearColor: 0x101010,
      nearShadeColor: 0x171717,
      midColor: 0x494949,
      farColor: 0xd7d7d7,
      hazeColor: 0xf1f1f1,
    },
  });
  const material = new MeshBasicMaterial();
  effects.terrain.applyTo(material);
  echoDepth.applyTo(material);
  const shader = createBasicShaderSource();

  material.onBeforeCompile(shader, undefined as never);

  const echoCallIndex = shader.fragmentShader.indexOf(
    "applyEchoDepth(diffuseColor.rgb)",
  );
  const thermalCallIndex = shader.fragmentShader.indexOf(
    "applyThermalPerception(diffuseColor.rgb)",
  );
  expect(echoCallIndex).toBeGreaterThan(-1);
  expect(thermalCallIndex).toBeGreaterThan(-1);
  expect(echoCallIndex).toBeLessThan(thermalCallIndex);
});

test("Thermal Perception reads water cold and high ground warm", () => {
  const effects = createThermalEffects();
  const worldSurface = createTestWorldSurface();
  const waterPoint = findZonePoint(worldSurface, "water");
  const meadowPoint = findZonePoint(worldSurface, "meadow");
  const waterWarmth = effects.terrain.warmthAt(
    waterPoint.x,
    waterPoint.z,
    worldSurface.groundYAt(waterPoint.x, waterPoint.z),
  );
  const meadowGroundY = worldSurface.groundYAt(meadowPoint.x, meadowPoint.z);
  const meadowWarmth = effects.terrain.warmthAt(
    meadowPoint.x,
    meadowPoint.z,
    meadowGroundY,
  );
  const higherWarmth = effects.terrain.warmthAt(
    meadowPoint.x,
    meadowPoint.z,
    meadowGroundY + 20,
  );

  expect(waterWarmth).toBeLessThan(meadowWarmth);
  expect(meadowWarmth).toBeLessThan(higherWarmth);
  for (const warmth of [waterWarmth, meadowWarmth, higherWarmth]) {
    expect(warmth).toBeGreaterThanOrEqual(0);
    expect(warmth).toBeLessThanOrEqual(1);
  }
});

test("Thermal Perception keeps the ground under the environment ceiling", () => {
  // The one budget rule the whole model rests on: nothing that is not alive
  // may reach the band living bodies occupy. Ground that could saturate the
  // ramp is what let a sunlit forest slope read hotter than a deer standing on
  // it, and it left the pools warm bodies leave behind nowhere to go.
  const effects = createThermalEffects();
  const worldSurface = createTestWorldSurface();
  const { kneeWarmth } = THERMAL_PERCEPTION_SETTINGS.environmentCeiling;

  let hottestGround = 0;
  for (let x = -96; x <= 96; x += 4) {
    for (let z = -96; z <= 96; z += 4) {
      const warmth = effects.terrain.warmthAt(
        x,
        z,
        worldSurface.groundYAt(x, z),
      );
      hottestGround = Math.max(hottestGround, warmth);
    }
  }

  // Terrain alone stays below the knee, which leaves the whole compression
  // range above it for the heat pools warm bodies add in the fragment stage.
  expect(hottestGround).toBeLessThan(kneeWarmth);
});

test("Thermal Perception separates the living band from the dead one", () => {
  const effects = createThermalEffects();
  const environmentShader = compileEffect(effects.terrain);
  const animalsShader = compileActorEffect(effects.animals);
  const ceiling = THERMAL_PERCEPTION_SETTINGS.environmentCeiling;
  const structure = THERMAL_PERCEPTION_SETTINGS.actorStructure;
  const environmentCeiling = environmentShader.uniforms.thermalWarmthCeiling
    ?.value as Vector2;
  const livingCeiling = animalsShader.uniforms.thermalWarmthCeiling
    ?.value as Vector2;

  expect(environmentCeiling.x).toBe(ceiling.kneeWarmth);
  expect(environmentCeiling.y).toBe(ceiling.ceilingWarmth);
  // Living bodies get a knee at the top of the range, where warmth is already
  // clamped, so the same expression leaves them untouched without a branch or
  // a second program.
  expect(livingCeiling.x).toBeGreaterThanOrEqual(1);

  // The coldest part of a living body still has to clear the ceiling the
  // environment can only approach, or the sense stops saying what is alive.
  const coldestBody = PARAMETERS.actorWarmth - structure.warmthRange;
  expect(coldestBody).toBeGreaterThan(ceiling.kneeWarmth);
});

test("Thermal Perception varies warmth inside every sensed object", () => {
  const effects = createThermalEffects();
  const vegetationShader = compileEffect(effects.vegetation);
  const animalsShader = compileActorEffect(effects.animals);

  // Vegetation and rocks read per part, not per plant: height above the
  // instance base and distance from its axis both move the warmth.
  expect(vegetationShader.vertexShader).toContain("heightProgress");
  expect(vegetationShader.vertexShader).toContain("axisProgress");
  expect(vegetationShader.uniforms.thermalHeightReferenceMeters?.value).toBe(
    THERMAL_PERCEPTION_SETTINGS.propStructure.heightReferenceMeters,
  );
  expect(vegetationShader.uniforms.thermalAxisWarmthHalfDrop?.value).toBe(
    THERMAL_PERCEPTION_SETTINGS.propStructure.axisWarmthHalfDrop,
  );

  // Animals hold a torso core and a separate head lobe, both placed as
  // fractions of the species' own body height.
  expect(animalsShader.vertexShader).toContain("coreLobe");
  expect(animalsShader.vertexShader).toContain("headLobe");
  expect(animalsShader.uniforms.thermalCoreHeightFraction?.value).toBe(
    THERMAL_PERCEPTION_SETTINGS.actorStructure.coreHeightFraction,
  );

  // The core is a volume rather than a band across a height: distance from the
  // body's own vertical axis carries the heat down through the flanks toward
  // nose and tail. It is the one lateral coordinate that survives the actor's
  // heading, since rotating a body turns it around exactly that axis.
  expect(animalsShader.vertexShader).toContain("bodyRadius");
  const coreRadiusSpread = animalsShader.uniforms.thermalCoreRadiusSpread
    ?.value as Vector2;
  expect(coreRadiusSpread.x).toBe(
    THERMAL_PERCEPTION_SETTINGS.actorStructure.coreRadiusInnerFraction,
  );
  expect(coreRadiusSpread.y).toBe(
    THERMAL_PERCEPTION_SETTINGS.actorStructure.coreRadiusOuterFraction,
  );
  expect(animalsShader.uniforms.thermalActorWarmthRange?.value).toBe(
    THERMAL_PERCEPTION_SETTINGS.actorStructure.warmthRange,
  );

  // Both carry the shared organic grain and the grazing-angle coolness that
  // keeps an object's silhouette readable once flat per-object color is gone.
  for (const shader of [vegetationShader, animalsShader]) {
    expect(shader.vertexShader).toContain("thermalGrain(");
    expect(shader.vertexShader).toContain("thermalGrazing(");
  }
});

test("Thermal Perception scales the body profile to the species height", () => {
  // The same profile has to fit a 0.25 m rat and a 1.6 m stag, so it is
  // authored in fractions of body height and every actor material carries its
  // own species height while sharing the program.
  const effects = createThermalEffects();
  const deer = compileActorEffect(effects.animals, 1.4);
  const rat = compileActorEffect(effects.animals, 0.25);

  expect(deer.uniforms.thermalBodyHeightMeters?.value).toBe(1.4);
  expect(rat.uniforms.thermalBodyHeightMeters?.value).toBe(0.25);
  expect(deer.vertexShader).toContain("thermalBodyHeightMeters");
});

test("Thermal Perception measures fine temperature detail per fragment", () => {
  // A vertex attribute can never be finer than the mesh carrying it, and the
  // terrain mesh is a two-metre grid. Everything below that scale — the two
  // detail octaves and the hotspots taken from the coarse one — has to be
  // measured in the fragment stage or the ground reads as flat regions.
  const effects = createThermalEffects();
  const terrainShader = compileEffect(effects.terrain);
  const animalsShader = compileActorEffect(effects.animals);
  const terrainDetail = THERMAL_PERCEPTION_SETTINGS.terrainWarmth.detail;

  for (const shader of [terrainShader, animalsShader]) {
    expect(shader.fragmentShader).toContain("thermalDetailOctaves()");
    expect(shader.fragmentShader).toContain("thermalHotspotWarmthAt(octaves)");
    expect(shader.vertexShader).toContain("thermalDetailPosition =");
    expect(shader.vertexShader).toContain("thermalWarmWeight =");
  }

  const wavelengths = terrainShader.uniforms.thermalDetailWavelengthMeters
    ?.value as Vector2;
  expect(wavelengths.x).toBe(terrainDetail.coarseWavelengthMeters);
  expect(wavelengths.y).toBe(terrainDetail.fineWavelengthMeters);
  // The fine octave is finer than a pixel long before the sense radius ends
  // and would shimmer on a moving head-mounted display, so it fades out.
  const fade = terrainShader.uniforms.thermalDetailFadeMeters?.value as Vector2;
  expect(fade.x).toBeLessThan(fade.y);

  // Each surface kind samples the field at its own scale: a plant's grain is
  // an order of magnitude finer than the ground's mottling.
  const animalWavelengths = animalsShader.uniforms.thermalDetailWavelengthMeters
    ?.value as Vector2;
  expect(animalWavelengths.x).toBeLessThan(wavelengths.x);

  // On a body the texture is grain over a temperature, never the temperature
  // itself: an animal is the one thing here heated from inside, and the whole
  // detail budget stays well under the span its profile covers from core to
  // hoof, so the gradient is what the eye reads and the grain only breaks up
  // the surface carrying it.
  const actor = THERMAL_PERCEPTION_SETTINGS.actorStructure;
  const detailReach =
    actor.detail.coarseWarmth +
    actor.detail.fineWarmth +
    actor.detail.hotspotWarmth;
  expect(detailReach).toBeLessThan(actor.warmthRange / 3);
});

test("Thermal Perception gives every prop instance its own detail phase", () => {
  // Instances of one model otherwise sample the field at identical model-local
  // coordinates and come out identically textured, which is exactly the "two
  // nearby surfaces at the same temperature" this sense has to avoid.
  const shader = compileEffect(createThermalEffects().vegetation);

  expect(shader.vertexShader).toContain("detailPhase = instanceHash");
  expect(shader.uniforms.thermalDetailPhaseMeters?.value).toBe(
    THERMAL_PERCEPTION_SETTINGS.propStructure.detailPhaseMeters,
  );
});

test("Thermal Perception interpolates the ramp without stop plateaus", () => {
  const effects = createThermalEffects();
  const shader = compileEffect(effects.terrain);
  const rampStart = shader.fragmentShader.indexOf("vec3 thermalRampColor");
  const rampBody = shader.fragmentShader.slice(
    rampStart,
    shader.fragmentShader.indexOf("vec3 applyThermalPerception"),
  );

  expect(rampStart).toBeGreaterThan(-1);
  // Every palette segment rises linearly and is then eased by a cubic whose
  // end slopes match, so the ramp is continuous in its first derivative — no
  // Mach band at a stop — while never reaching zero slope, which is what parks
  // neighbouring temperatures on one color and reads as a band.
  expect(rampBody).toContain("thermalSegment(warmth, 0.0, thermalRampStops.x)");
  expect(rampBody).toContain("thermalEase(");
  expect(rampBody.match(/smoothstep\(/g)).toBeNull();
  expect(THERMAL_PERCEPTION_SETTINGS.ramp.segmentEase).toBeGreaterThan(0);
  expect(THERMAL_PERCEPTION_SETTINGS.ramp.segmentEase).toBeLessThan(1);

  // The easing is only C1 across a join while neighbouring segments are the
  // same width, so the stops have to stay evenly spaced.
  const {
    coldStopFraction,
    coolStopFraction,
    warmStopFraction,
    hotStopFraction,
  } = THERMAL_PERCEPTION_SETTINGS.ramp;
  const widths = [
    coldStopFraction,
    coolStopFraction - coldStopFraction,
    warmStopFraction - coolStopFraction,
    hotStopFraction - warmStopFraction,
    1 - hotStopFraction,
  ];
  for (const width of widths) {
    expect(width).toBeCloseTo(widths[0] as number, 6);
  }
});

test("Thermal Perception keeps surface tone visible through the ramp", () => {
  const effects = createThermalEffects();
  const shader = compileEffect(effects.vegetation);
  const luminance = THERMAL_PERCEPTION_SETTINGS.surfaceLuminance;

  // The shading reads the material's authored color, not the incoming
  // diffuseColor: the carried echo ramp runs first and at full intensity has
  // already replaced that with a pure camera-distance value.
  expect(shader.fragmentShader).toContain("dot(diffuse,");
  expect(shader.fragmentShader).toContain("shadeBySurface(");
  expect(shader.uniforms.thermalLuminanceAmount?.value).toBe(
    luminance.structureAmount,
  );

  // A thermal camera has no albedo, so the slot tone moves the temperature as
  // well: that is what keeps a trunk from reading identical to its foliage.
  expect(shader.uniforms.thermalToneWarmth?.value).toBe(
    THERMAL_PERCEPTION_SETTINGS.propStructure.detail.toneWarmth,
  );

  // The scene is unlit, so the sense supplies the one geometric light that
  // makes foliage read as volume rather than a flat cutout.
  expect(shader.vertexShader).toContain("thermalHemisphericShade(");
  expect(shader.uniforms.thermalSkyShade?.value).toBeGreaterThan(
    shader.uniforms.thermalGroundShade?.value as number,
  );

  // Terrain deleted its normal attribute, so it cannot shade and must pass the
  // neutral value rather than an undefined varying.
  const terrainShader = compileEffect(effects.terrain);
  expect(terrainShader.vertexShader).toContain("thermalSurfaceShade = 1.0;");
  expect(terrainShader.vertexShader).not.toContain("thermalHemisphericShade(");

  // Bounded on both sides: an unbounded product would crush the darkest
  // material slots to black and blow the palest ones past the palette.
  expect(shader.uniforms.thermalMinimumShade?.value).toBe(
    luminance.minimumShade,
  );
  expect(shader.uniforms.thermalMaximumShade?.value).toBe(
    luminance.maximumShade,
  );
  expect(luminance.minimumShade).toBeGreaterThan(0);
  expect(luminance.maximumShade).toBeGreaterThan(luminance.minimumShade);
});

test("Thermal Perception shimmers grass with its own sway", () => {
  const effects = createThermalEffects();
  const shader = compileEffect(effects.grass);
  const structure = THERMAL_PERCEPTION_SETTINGS.grassStructure;

  // Grass publishes its blade progress and sway at the injection point, so the
  // sense reads the motion without learning how the wind works.
  expect(shader.vertexShader).toContain(
    "passThermalPerception(mvPosition, transformed, grassBladeProgress, grassSway)",
  );
  expect(shader.uniforms.thermalShimmerWarmth?.value).toBe(
    structure.shimmerWarmth,
  );

  // The shimmer rides the blade, not a clock: adding a time uniform here would
  // make the heat field itself animate, which the level explicitly does not.
  expect(shader.vertexShader).not.toContain("Time");

  // Grass is vegetation, so it starts from the authored vegetation warmth.
  expect(shader.uniforms.thermalBaseWarmth?.value).toBe(
    PARAMETERS.surfaces.vegetationWarmth,
  );
  expect(shader.uniforms.thermalRootWarmthBoost?.value).toBe(
    structure.rootWarmthBoost,
  );

  // The sward has no per-tuft warmth source of its own, so what makes one tuft
  // differ from the next is sampling the detail field in world space.
  expect(shader.vertexShader).toContain(
    "thermalDetailPosition = worldPosition;",
  );
});

test("Thermal Perception pools ground heat per fragment under published sources", () => {
  const effects = createThermalEffects();
  const shader = compileEffect(effects.terrain);
  const sources = shader.uniforms.thermalHeatSources?.value as Vector4[];
  const { warmth, radiusMeters, edgeBreakup } =
    THERMAL_PERCEPTION_SETTINGS.groundHeat;

  expect(sources).toHaveLength(THERMAL_GROUND_HEAT_SOURCE_COUNT);
  expect(shader.uniforms.thermalGroundHeatRadiusMeters?.value).toBe(
    radiusMeters,
  );
  expect(shader.uniforms.thermalGroundHeatEdgeBreakup?.value).toBe(edgeBreakup);
  // The fixed uniform array size is a compile-time constant in the shader and
  // must keep matching the capacity the module publishes into.
  expect(shader.fragmentShader).toContain(
    `const int THERMAL_HEAT_SOURCE_COUNT = ${THERMAL_GROUND_HEAT_SOURCE_COUNT};`,
  );

  // The pool is measured per fragment: terrain vertices sit two metres apart,
  // so a pool this small resolved into three or four samples and read as the
  // flat faceted disc this replaces.
  expect(shader.fragmentShader).toContain("thermalGroundHeat(");
  expect(shader.vertexShader).not.toContain("thermalGroundHeat(");
  // A body length across, not a clearing: the pool is heat the animal leaves
  // on the ground it stands on, and a wider or stronger one reads as the
  // animal standing in the middle of a warm disc.
  expect(radiusMeters).toBeLessThan(2);
  expect(warmth).toBeLessThan(
    THERMAL_PERCEPTION_SETTINGS.actorStructure.warmthRange,
  );

  // Only terrain receives external heat, and only terrain's program compiles
  // the loop: nothing else pays for it.
  const grassShader = compileEffect(effects.grass);
  expect(grassShader.fragmentShader).not.toContain("thermalHeatSources");

  effects.terrain.clearHeatSources();
  effects.terrain.addHeatSource(4, 1, -7);
  expect(sources[0]).toEqual(new Vector4(4, 1, -7, warmth));
  // Unused slots carry zero strength, so they contribute nothing without the
  // shader needing a branch over the live count.
  expect(sources[1]?.w).toBe(0);

  // Publishing more sources than the array holds drops the extras instead of
  // growing the uniform or throwing.
  for (
    let index = 0;
    index < THERMAL_GROUND_HEAT_SOURCE_COUNT + 3;
    index += 1
  ) {
    effects.terrain.addHeatSource(index, 0, 0);
  }
  expect(sources).toHaveLength(THERMAL_GROUND_HEAT_SOURCE_COUNT);

  effects.terrain.clearHeatSources();
  expect(sources.every(({ w }) => w === 0)).toBe(true);
});

test("Thermal Perception mottles ground warmth without reordering the bands", () => {
  const effects = createThermalEffects();
  const worldSurface = createTestWorldSurface();
  const warmthAt = (x: number, z: number) =>
    effects.terrain.warmthAt(x, z, worldSurface.groundYAt(x, z));

  const waterWarmths: number[] = [];
  const landWarmths: number[] = [];
  for (let x = -64; x <= 64; x += 4) {
    for (let z = -64; z <= 64; z += 4) {
      const target =
        worldSurface.zoneAt(x, z) === "water" ? waterWarmths : landWarmths;
      target.push(warmthAt(x, z));
    }
  }

  // Neighbouring ground no longer shares one flat value.
  expect(new Set(landWarmths).size).toBeGreaterThan(1);
  // The mottling only ever adds warmth and canopy shade only ever scales the
  // exposure gain, so every water sample still reads colder than every
  // dry-ground sample.
  expect(Math.max(...waterWarmths)).toBeLessThan(Math.min(...landWarmths));
  for (const value of [...waterWarmths, ...landWarmths]) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
});

test("Thermal Perception rejects an out-of-range intensity", () => {
  expect(() => createThermalEffects({ ...PARAMETERS, intensity: 1.2 })).toThrow(
    "Thermal intensity and warmth values must be between zero and one",
  );
});

test("Thermal Perception requires the feather to fit inside the radius", () => {
  expect(() =>
    createThermalEffects({ ...PARAMETERS, edgeFeatherMeters: 30 }),
  ).toThrow("Thermal edge feather must be positive and fit inside the radius");
});

test("Thermal Perception rejects an animal that cannot outrank the ground", () => {
  expect(() =>
    createThermalEffects({ ...PARAMETERS, actorWarmth: 0.5 }),
  ).toThrow("Thermal actor warmth must stay above the environment ceiling");
});

function createThermalEffects(
  parameters: ThermalPerceptionParameters = PARAMETERS,
) {
  const worldSurface = createTestWorldSurface();
  return createThermalPerception(parameters, {
    surfaceSettings: WORLD_SURFACE_SETTINGS,
    conditionsAt: worldSurface.zoneConditionsAt,
  });
}

function createTestWorldSurface() {
  return createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);
}

function squareColor(color: Color): Color {
  return new Color().setRGB(
    color.r * color.r,
    color.g * color.g,
    color.b * color.b,
  );
}

function findZonePoint(
  worldSurface: ReturnType<typeof createTestWorldSurface>,
  zone: string,
): { readonly x: number; readonly z: number } {
  for (let x = -64; x <= 64; x += 4) {
    for (let z = -64; z <= 64; z += 4) {
      if (worldSurface.zoneAt(x, z) === zone) return { x, z };
    }
  }
  throw new Error(`No ${zone} point inside the searched area`);
}

function compileEffect(effect: {
  readonly applyTo: (material: MeshBasicMaterial) => void;
}): Parameters<MeshBasicMaterial["onBeforeCompile"]>[0] {
  return compileMaterial((material) => {
    effect.applyTo(material);
  });
}

function compileActorEffect(
  effect: {
    readonly applyTo: (
      material: MeshBasicMaterial,
      bodyHeightMeters: number,
    ) => void;
  },
  bodyHeightMeters: number = DEER_HEIGHT_METERS,
): Parameters<MeshBasicMaterial["onBeforeCompile"]>[0] {
  return compileMaterial((material) => {
    effect.applyTo(material, bodyHeightMeters);
  });
}

function compileMaterial(
  decorate: (material: MeshBasicMaterial) => void,
): Parameters<MeshBasicMaterial["onBeforeCompile"]>[0] {
  const material = new MeshBasicMaterial();
  decorate(material);
  const shader = createBasicShaderSource();
  material.onBeforeCompile(shader, undefined as never);
  return shader;
}

function createBasicShaderSource(): Parameters<
  MeshBasicMaterial["onBeforeCompile"]
>[0] {
  const shader = {
    uniforms: {},
    vertexShader:
      "#include <common>\nvoid main() { #include <begin_vertex>\n#include <project_vertex> }",
    fragmentShader:
      "#include <common>\nvoid main() { vec4 diffuseColor = vec4( diffuse, opacity ); #include <color_fragment> }",
  };

  return shader as Parameters<MeshBasicMaterial["onBeforeCompile"]>[0];
}
