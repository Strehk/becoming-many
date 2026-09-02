/**
 * Purpose: Verify the shared material decoration produced by Echo Depth.
 * Context: One depth ramp must decorate Terrain, Vegetation, and Rocks passes alike.
 * Responsibility: Cover parameter wiring, shader injection, chaining, and validation.
 * Boundary: Visual ramp quality and physical PCVR performance require runtime acceptance.
 */

import { expect, test } from "bun:test";
import { MeshBasicMaterial } from "three";
import {
  createEchoDepth,
  type EchoDepthParameters,
} from "../../src/modules/echo-depth/echo-depth";
import { createZoneVisualizer } from "../../src/modules/zone-visualizer/zone-visualizer";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const PARAMETERS: EchoDepthParameters = {
  intensity: 1,
  nearDistanceMeters: 6,
  farDistanceMeters: 120,
  colors: {
    nearColor: 0x0e1017,
    nearShadeColor: 0x0d1730,
    midColor: 0x3c4782,
    farColor: 0xcbd9e5,
    hazeColor: 0xf6f0e9,
  },
};

test("Echo Depth injects one view-distance ramp into both stages", () => {
  const effect = createEchoDepth(PARAMETERS);
  const material = new MeshBasicMaterial({ color: 0x0d1730 });
  effect.applyTo(material);
  const shader = createBasicShaderSource();

  material.onBeforeCompile(shader, undefined as never);

  expect(shader.vertexShader).toContain("passEchoDepth(mvPosition)");
  expect(shader.fragmentShader).toContain("applyEchoDepth(diffuseColor.rgb)");
  expect(shader.uniforms.echoIntensity?.value).toBe(1);
  expect(shader.uniforms.echoNearDistance?.value).toBe(6);
  expect(shader.uniforms.echoFarDistance?.value).toBe(120);
  expect(shader.uniforms.echoNearColor?.value.getHex()).toBe(0x0e1017);
  expect(shader.uniforms.echoHazeColor?.value.getHex()).toBe(0xf6f0e9);
});

test("Echo Depth shows only the depth ramp without proximity accents", () => {
  const effect = createEchoDepth(PARAMETERS);
  const material = new MeshBasicMaterial();
  effect.applyTo(material);
  const shader = createBasicShaderSource();

  material.onBeforeCompile(shader, undefined as never);

  expect(shader.vertexShader).not.toContain("normal");
  expect(shader.fragmentShader).not.toContain("Rim");
  expect(shader.uniforms.echoRimColor).toBeUndefined();
  expect(shader.uniforms.echoRimStrength).toBeUndefined();
});

test("Echo Depth shares one uniform set across patched materials", () => {
  const effect = createEchoDepth(PARAMETERS);
  const first = new MeshBasicMaterial();
  const second = new MeshBasicMaterial();
  effect.applyTo(first);
  effect.applyTo(second);
  const firstShader = createBasicShaderSource();
  const secondShader = createBasicShaderSource();

  first.onBeforeCompile(firstShader, undefined as never);
  second.onBeforeCompile(secondShader, undefined as never);

  expect(firstShader.uniforms.echoIntensity).toBe(
    secondShader.uniforms.echoIntensity as never,
  );
});

test("Echo Depth preserves the Zone Visualizer as its base color", () => {
  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const zoneVisualization = createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  const baseCacheKey = zoneVisualization.material.customProgramCacheKey();
  createEchoDepth(PARAMETERS).applyTo(zoneVisualization.material);
  const shader = createBasicShaderSource();

  zoneVisualization.material.onBeforeCompile(shader, undefined as never);

  expect(shader.fragmentShader).toContain("getZoneColor()");
  expect(shader.fragmentShader).toContain("applyEchoDepth(diffuseColor.rgb)");
  expect(zoneVisualization.material.customProgramCacheKey()).toBe(
    `${baseCacheKey}:echo-depth-v2`,
  );
});

test("Echo Depth rejects an out-of-range intensity", () => {
  expect(() =>
    createEchoDepth({
      ...PARAMETERS,
      intensity: 1.2,
    }),
  ).toThrow("Echo depth intensity must be between zero and one");
});

test("Echo Depth requires the near distance below the far distance", () => {
  expect(() =>
    createEchoDepth({
      ...PARAMETERS,
      nearDistanceMeters: 120,
      farDistanceMeters: 120,
    }),
  ).toThrow("Echo depth distances must be positive with near below far");
});

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
