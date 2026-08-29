/**
 * Purpose: Verify the shared material decoration produced by Thermal Perception.
 * Context: One heat view must decorate Terrain, Vegetation, Rocks, and Animals passes alike.
 * Responsibility: Cover parameter wiring, shader injection, effect ordering, warmth sampling, and validation.
 * Boundary: Visual ramp quality and physical PICO performance require runtime acceptance.
 */

import { expect, test } from "bun:test";
import { Matrix4, MeshBasicMaterial } from "three";
import { createEchoDepth } from "../../src/modules/echo-depth/echo-depth";
import {
  createThermalPerception,
  type ThermalPerceptionParameters,
} from "../../src/modules/thermal-perception/thermal-perception";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

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
    vegetationWarmth: 0.45,
    vegetationWarmthSpread: 0.12,
    vegetationHeightWarmthPerMeter: -0.02,
    vegetationAxisWarmthPerMeter: -0.03,
    vegetationTextureWarmth: 0.07,
    rockWarmth: 0.3,
    rockWarmthSpread: 0.08,
    rockHeightWarmthPerMeter: 0.22,
    rockAxisWarmthPerMeter: -0.07,
    rockTextureWarmth: 0.05,
  },
  terrainTextureWarmth: 0.06,
  actorWarmth: 0.92,
  actorExtremityFalloff: 0.4,
  actorTextureWarmth: 0.1,
  heatEmission: {
    strength: 0.3,
    reachPerBodyHeight: 1.6,
  },
};

test("Thermal Perception injects the radius-bounded ramp into both stages", () => {
  const effects = createThermalEffects();
  const material = new MeshBasicMaterial();
  effects.terrain.applyTo(material);
  const shader = createBasicShaderSource();

  material.onBeforeCompile(shader, undefined as never);

  expect(shader.vertexShader).toContain(
    "passThermalPerception(mvPosition, transformed)",
  );
  expect(shader.vertexShader).toContain("attribute float thermalWarmth");
  expect(shader.fragmentShader).toContain(
    "applyThermalPerception(diffuseColor.rgb)",
  );
  expect(shader.uniforms.thermalIntensity?.value).toBe(1);
  expect(shader.uniforms.thermalRadiusMeters?.value).toBe(30);
  expect(shader.uniforms.thermalEdgeFeatherMeters?.value).toBe(10);
  expect(shader.uniforms.thermalColdestColor?.value.getHex()).toBe(0x2e1386);
  expect(shader.uniforms.thermalHottestColor?.value.getHex()).toBe(0xfcce43);
});

test("Thermal Perception gives each consumer its own warmth source", () => {
  const effects = createThermalEffects();
  const vegetationShader = compileEffect(effects.vegetation);
  const rocksShader = compileEffect(effects.rocks);
  const animalsShader = compileEffect(effects.animals(new Matrix4()));

  expect(vegetationShader.vertexShader).toContain("thermalInstanceHash");
  expect(vegetationShader.uniforms.thermalBaseWarmth?.value).toBe(0.45);
  expect(vegetationShader.uniforms.thermalWarmthSpread?.value).toBe(0.12);
  expect(rocksShader.uniforms.thermalBaseWarmth?.value).toBe(0.3);
  expect(rocksShader.uniforms.thermalWarmthSpread?.value).toBe(0.08);
  expect(animalsShader.vertexShader).toContain("thermalActorWarmth");
  expect(animalsShader.uniforms.thermalActorWarmth?.value).toBe(0.92);
});

test("Thermal Perception varies warmth across each object it decorates", () => {
  const effects = createThermalEffects();
  const bodyMatrix = new Matrix4().makeScale(0.5, 0.5, 0.5);
  const vegetationShader = compileEffect(effects.vegetation);
  const rocksShader = compileEffect(effects.rocks);
  const animalsShader = compileEffect(effects.animals(bodyMatrix));

  // Plants shed heat upward and outward; a sunlit rock top gains it.
  expect(vegetationShader.uniforms.thermalHeightWarmthPerMeter?.value).toBe(
    -0.02,
  );
  expect(vegetationShader.uniforms.thermalAxisWarmthPerMeter?.value).toBe(
    -0.03,
  );
  expect(rocksShader.uniforms.thermalHeightWarmthPerMeter?.value).toBe(0.22);
  expect(rocksShader.uniforms.thermalAxisWarmthPerMeter?.value).toBe(-0.07);
  expect(vegetationShader.vertexShader).toContain(
    "thermalHeightWarmthPerMeter",
  );

  // Each animated mesh measures against its own actor's body space.
  expect(animalsShader.uniforms.thermalActorBodyMatrix?.value).toBe(bodyMatrix);
  expect(animalsShader.uniforms.thermalActorExtremityFalloff?.value).toBe(0.4);
  expect(animalsShader.vertexShader).toContain("thermalActorBodyMatrix");
  expect(animalsShader.vertexShader).toContain(
    "passThermalPerception(mvPosition, transformed)",
  );
});

test("Thermal Perception textures every sensed surface at its own depth", () => {
  const effects = createThermalEffects();
  const terrainShader = compileEffect(effects.terrain);
  const vegetationShader = compileEffect(effects.vegetation);
  const rocksShader = compileEffect(effects.rocks);
  const animalsShader = compileEffect(effects.animals(new Matrix4()));

  expect(terrainShader.uniforms.thermalTextureWarmth?.value).toBe(0.06);
  expect(vegetationShader.uniforms.thermalTextureWarmth?.value).toBe(0.07);
  expect(rocksShader.uniforms.thermalTextureWarmth?.value).toBe(0.05);
  expect(animalsShader.uniforms.thermalTextureWarmth?.value).toBe(0.1);

  // World surfaces share one patch size in metres; a body measures its own
  // texture as a share of its height, so every species carries like detail.
  const worldFeatureSize = terrainShader.uniforms.thermalTextureFeatureSize
    ?.value as number;
  expect(vegetationShader.uniforms.thermalTextureFeatureSize?.value).toBe(
    worldFeatureSize,
  );
  expect(rocksShader.uniforms.thermalTextureFeatureSize?.value).toBe(
    worldFeatureSize,
  );
  expect(animalsShader.uniforms.thermalTextureFeatureSize?.value).not.toBe(
    worldFeatureSize,
  );

  // The texture is multi-scale and reaches the ramp before the palette does.
  expect(terrainShader.fragmentShader).toContain("thermalTextureField");
  expect(terrainShader.vertexShader).toContain("thermalTexturePosition");
  expect(terrainShader.uniforms.thermalTextureShape).toBe(
    animalsShader.uniforms.thermalTextureShape as never,
  );
});

test("Thermal Perception radiates warmth from the bodies it is told about", () => {
  const effects = createThermalEffects();
  const terrainShader = compileEffect(effects.terrain);
  const animalsShader = compileEffect(effects.animals(new Matrix4()));

  // Nothing radiates until the world reports its warm bodies.
  expect(terrainShader.uniforms.thermalHeatCount?.value).toBe(0);

  effects.setHeatSources([
    { x: 4, y: -8, z: 6, headingRadians: 0, heightMeters: 1.4 },
  ]);

  // One shared source set reaches every sensed surface at once.
  expect(terrainShader.uniforms.thermalHeatCount?.value).toBe(1);
  expect(animalsShader.uniforms.thermalHeatCount).toBe(
    terrainShader.uniforms.thermalHeatCount as never,
  );

  // Packed as an oriented segment on the body axis, lifted to the emitting
  // core height, and reaching in proportion to the animal's own size.
  const body = terrainShader.uniforms.thermalHeatBodies?.value[0];
  const axis = terrainShader.uniforms.thermalHeatAxes?.value[0];
  expect(body.x).toBe(4);
  expect(body.y).toBeGreaterThan(-8);
  expect(body.w).toBeGreaterThan(0);
  expect(axis.z).toBeCloseTo(1.4 * 1.6, 5);
  expect(axis.w).toBe(0.3);

  // Ground, plants, and rocks answer to it; a living body does not.
  expect(terrainShader.uniforms.thermalHeatResponse?.value).toBe(1);
  expect(compileEffect(effects.rocks).uniforms.thermalHeatResponse?.value).toBe(
    1,
  );
  expect(animalsShader.uniforms.thermalHeatResponse?.value).toBe(0);
  expect(terrainShader.fragmentShader).toContain("thermalRadiatedWarmth");
});

test("Thermal Perception bounds the warm bodies it tracks", () => {
  const effects = createThermalEffects();
  const shader = compileEffect(effects.terrain);
  const source = { x: 0, y: 0, z: 0, headingRadians: 0, heightMeters: 1 };

  effects.setHeatSources(Array.from({ length: 12 }, () => source));

  const bounded = shader.uniforms.thermalHeatCount?.value as number;
  expect(bounded).toBeLessThanOrEqual(
    shader.uniforms.thermalHeatBodies?.value.length as number,
  );
  expect(shader.fragmentShader).toContain("#define THERMAL_HEAT_SOURCES");
});

test("Thermal Perception gives each animated mesh its own body matrix", () => {
  const effects = createThermalEffects();
  const first = new Matrix4().makeTranslation(1, 0, 0);
  const second = new Matrix4().makeTranslation(0, 2, 0);

  const firstShader = compileEffect(effects.animals(first));
  const secondShader = compileEffect(effects.animals(second));

  expect(firstShader.uniforms.thermalActorBodyMatrix?.value).toBe(first);
  expect(secondShader.uniforms.thermalActorBodyMatrix?.value).toBe(second);
});

test("Thermal Perception shares one uniform set across all variants", () => {
  const effects = createThermalEffects();
  const terrainShader = compileEffect(effects.terrain);
  const vegetationShader = compileEffect(effects.vegetation);
  const animalsShader = compileEffect(effects.animals(new Matrix4()));

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
  effects.animals(new Matrix4()).applyTo(animals);

  expect(terrain.customProgramCacheKey()).toEndWith(":thermal-terrain-v4");
  expect(vegetation.customProgramCacheKey()).toEndWith(":thermal-instanced-v4");
  expect(rocks.customProgramCacheKey()).toEndWith(":thermal-instanced-v4");
  expect(animals.customProgramCacheKey()).toEndWith(":thermal-actor-v4");
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
  const material = new MeshBasicMaterial();
  effect.applyTo(material);
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
