/**
 * Purpose: Verify the terrain presentation produced by Magnetic Sense.
 * Context: Field lines must animate in one existing terrain pass with stable world coordinates.
 * Responsibility: Cover parameter wiring, shader behavior, direction, time, and validation.
 * Boundary: Visual glow quality and physical PICO performance require runtime acceptance.
 */

import { expect, test } from "bun:test";
import { MeshBasicMaterial } from "three";
import {
  createMagneticSense,
  type MagneticSenseParameters,
} from "../../src/modules/magnetic-sense/magnetic-sense";
import { createZoneVisualizer } from "../../src/modules/zone-visualizer/zone-visualizer";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const PARAMETERS: MagneticSenseParameters = {
  fieldDirectionDegreesFromNorth: 0,
  lineSpacingMeters: 8,
  lineWidthMeters: 0.35,
  pulseWidthMeters: 0.1,
  lineOpacity: 0.2,
  flowSpeedMetersPerSecond: 8,
  intensity: 1,
};

test("Magnetic Sense injects one world-space terrain line shader", () => {
  const effect = createMagneticSense(PARAMETERS);
  const material = new MeshBasicMaterial({ color: 0x4ea96b });
  effect.applyTo(material);
  effect.update?.(1.5);
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
});

test("Magnetic Sense keeps the pulse inside its line", () => {
  expect(() =>
    createMagneticSense({
      ...PARAMETERS,
      pulseWidthMeters: 0.5,
    }),
  ).toThrow("Magnetic pulse must fit inside its line");
});

test("Magnetic Sense rejects invalid line opacity", () => {
  expect(() =>
    createMagneticSense({
      ...PARAMETERS,
      lineOpacity: 1.1,
    }),
  ).toThrow("Magnetic line opacity must be between zero and one");
});

test("Magnetic Sense preserves the Zone Visualizer as its base color", () => {
  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const zoneVisualization = createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  createMagneticSense(PARAMETERS).applyTo(zoneVisualization.material);
  const shader = createBasicShaderSource();

  zoneVisualization.material.onBeforeCompile(shader, undefined as never);

  expect(shader.fragmentShader).toContain("getZoneColor()");
  expect(shader.fragmentShader).toContain(
    "applyMagneticLines(diffuseColor.rgb)",
  );
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
