/**
 * Purpose: Verify the terrain and sky presentation produced by Magnetic Sense.
 * Context: Field lines and the sky glow must share one uniform set with stable world coordinates.
 * Responsibility: Cover parameter wiring, shader behavior, sky lifecycle, and validation.
 * Boundary: Visual glow quality and physical PICO performance require runtime acceptance.
 */

import { expect, test } from "bun:test";
import {
  BackSide,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
} from "three";
import {
  createMagneticSense,
  type MagneticSenseOptions,
  type MagneticSenseParameters,
} from "../../src/modules/magnetic-sense/magnetic-sense";
import { createZoneVisualizer } from "../../src/modules/zone-visualizer/zone-visualizer";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const PARAMETERS: MagneticSenseParameters = {
  intensity: 1,
  fieldDirectionDegreesFromNorth: 0,
  lineSpacingMeters: 8,
  lineWidthMeters: 0.35,
  pulseWidthMeters: 0.1,
  lineOpacity: 0.2,
  flowSpeedMetersPerSecond: 8,
  colors: {
    lineColor: 0x1140a4,
    pulseColor: 0xcddbe2,
    skyGlowColor: 0x1140a4,
  },
};

function createOptions(): MagneticSenseOptions {
  return {
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    skyHazeColor: 0xf1f1f1,
  };
}

test("Magnetic Sense injects one world-space terrain line shader", () => {
  const effects = createMagneticSense(PARAMETERS, createOptions());
  const material = new MeshBasicMaterial({ color: 0x4ea96b });
  effects.terrain.applyTo(material);
  effects.terrain.update?.(1.5);
  const shader = createBasicShaderSource();

  material.onBeforeCompile(shader, undefined as never);

  expect(shader.vertexShader).toContain("passMagneticWorldPosition");
  expect(shader.fragmentShader).toContain("applyMagneticLines");
  expect(shader.fragmentShader).toContain(
    "applyMagneticLines(diffuseColor.rgb)",
  );
  expect(shader.fragmentShader).not.toContain("magneticTerrainColor");
  expect(shader.fragmentShader).toContain("fwidth(stream)");
  expect(shader.fragmentShader).toContain("line * pulseCrossSection * flow");
  expect(shader.uniforms.magneticPulseWidth?.value).toBe(0.1);
  expect(shader.uniforms.magneticLineOpacity?.value).toBe(0.2);
  expect(shader.uniforms.magneticTime?.value).toBe(1.5);
  expect(shader.uniforms.magneticLineSpacing?.value).toBe(8);
  expect(shader.uniforms.magneticFieldDirection?.value.toArray()).toEqual([
    0, 1,
  ]);
  // The preset palette reaches the shader; no module constants remain.
  expect(shader.uniforms.magneticLineColor?.value.getHex()).toBe(0x1140a4);
  expect(shader.uniforms.magneticPulseColor?.value.getHex()).toBe(0xcddbe2);
});

test("Magnetic Sense keeps the pulse inside its line", () => {
  expect(() =>
    createMagneticSense(
      {
        ...PARAMETERS,
        pulseWidthMeters: 0.5,
      },
      createOptions(),
    ),
  ).toThrow("Magnetic pulse must fit inside its line");
});

test("Magnetic Sense rejects invalid line opacity", () => {
  expect(() =>
    createMagneticSense(
      {
        ...PARAMETERS,
        lineOpacity: 1.1,
      },
      createOptions(),
    ),
  ).toThrow("Magnetic line opacity must be between zero and one");
});

test("Magnetic Sense rejects an intensity above full strength", () => {
  expect(() =>
    createMagneticSense(
      {
        ...PARAMETERS,
        intensity: 1.5,
      },
      createOptions(),
    ),
  ).toThrow("Magnetic intensity must be between zero and one");
});

test("Magnetic Sense preserves the Zone Visualizer as its base color", () => {
  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const zoneVisualization = createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  createMagneticSense(PARAMETERS, createOptions()).terrain.applyTo(
    zoneVisualization.material,
  );
  const shader = createBasicShaderSource();

  zoneVisualization.material.onBeforeCompile(shader, undefined as never);

  expect(shader.fragmentShader).toContain("getZoneColor()");
  expect(shader.fragmentShader).toContain(
    "applyMagneticLines(diffuseColor.rgb)",
  );
});

test("Magnetic sky dome follows the world module lifecycle", () => {
  const options = createOptions();
  const effects = createMagneticSense(PARAMETERS, options);

  effects.sky.load();
  const dome = options.scene.children.find(
    (child) => "material" in child && child.material instanceof ShaderMaterial,
  );
  if (!dome || !("material" in dome)) {
    throw new Error("Loading the sky must add the dome to the scene");
  }
  const material = dome.material as ShaderMaterial;

  // An opaque backdrop drawn first: never lit, never writing depth.
  expect(material.side).toBe(BackSide);
  expect(material.depthWrite).toBe(false);
  expect(material.transparent).toBe(false);
  expect(dome.renderOrder).toBe(-1);
  expect(dome.frustumCulled).toBe(false);
  expect(dome.visible).toBe(false);
  expect(material.uniforms.magneticSkyHazeColor?.value.getHex()).toBe(0xf1f1f1);
  expect(material.uniforms.magneticSkyGlowColor?.value.getHex()).toBe(0x1140a4);

  effects.sky.activate();
  expect(dome.visible).toBe(true);

  options.camera.position.set(12, 34, -56);
  effects.sky.update?.(0.016);
  expect(dome.position.toArray()).toEqual([12, 34, -56]);

  effects.sky.deactivate();
  expect(dome.visible).toBe(false);

  effects.sky.unload();
  expect(options.scene.children).toHaveLength(0);
});

test("Magnetic Sense shares field uniforms between terrain and sky", () => {
  const options = createOptions();
  const effects = createMagneticSense(PARAMETERS, options);
  const material = new MeshBasicMaterial();
  effects.terrain.applyTo(material);
  const shader = createBasicShaderSource();
  material.onBeforeCompile(shader, undefined as never);

  effects.sky.load();
  const dome = options.scene.children[0];
  if (!dome || !("material" in dome)) {
    throw new Error("Loading the sky must add the dome to the scene");
  }
  const skyUniforms = (dome.material as ShaderMaterial).uniforms;

  // Shared by identity: one dramaturgy write reaches both consumers.
  expect(skyUniforms.magneticFieldDirection).toBe(
    shader.uniforms.magneticFieldDirection,
  );
  expect(skyUniforms.magneticIntensity).toBe(shader.uniforms.magneticIntensity);
});

function createBasicShaderSource(): Parameters<
  MeshBasicMaterial["onBeforeCompile"]
>[0] {
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\nvoid main() { #include <begin_vertex> }",
    fragmentShader:
      "#include <common>\nvoid main() { vec4 diffuseColor = vec4( diffuse, opacity ); #include <color_fragment> }",
  };

  return shader as Parameters<MeshBasicMaterial["onBeforeCompile"]>[0];
}
