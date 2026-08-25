/**
 * Purpose: Verify the diagnostic material built from continuous zone conditions.
 * Context: Hard test colors must be complete without becoming world-surface data.
 * Responsibility: Cover color identity, shader wiring, and the sampled condition source.
 * Boundary: Terrain attributes and zone classification formulas are tested separately.
 */

import { expect, test } from "bun:test";
import type { MeshBasicMaterial } from "three";
import {
  createZoneVisualizer,
  ZONE_COLOR_VALUES,
} from "../../src/modules/zone-visualizer/zone-visualizer";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

test("Zone Visualizer keeps one distinct diagnostic color per zone", () => {
  expect(new Set(Object.values(ZONE_COLOR_VALUES)).size).toBe(5);
});

test("Zone Visualizer classifies interpolated conditions in the material", () => {
  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const visualization = createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  const shader = createBasicShaderSource();

  visualization.material.onBeforeCompile(shader, undefined as never);

  expect(visualization.conditionsAt).toBe(worldSurface.zoneConditionsAt);
  expect(shader.vertexShader).toContain("attribute vec4 zoneConditions");
  expect(shader.fragmentShader).toContain("vec3 getZoneColor()");
  expect(shader.uniforms.zoneShrubSlopeThreshold?.value).toBe(
    ZONE_SETTINGS.shrubSlopeThreshold,
  );
});

function createBasicShaderSource(): Parameters<
  MeshBasicMaterial["onBeforeCompile"]
>[0] {
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\nvoid main() { #include <begin_vertex> }",
    fragmentShader:
      "#include <common>\nvoid main() { vec4 diffuseColor = vec4( diffuse, opacity ); }",
  };

  return shader as Parameters<MeshBasicMaterial["onBeforeCompile"]>[0];
}
