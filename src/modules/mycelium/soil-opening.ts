/**
 * Purpose: Turn the carried ground into soil the visitor can see the mat through.
 * Context: Level 07 shows a root system, and a root system under opaque ground is not shown.
 * Responsibility: Own the opening uniforms, the blend state, the cover sampler, and the injection.
 * Boundary: The terrain module keeps its material, geometry, and colors; only alpha changes.
 */

import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import type { TerrainMaterialEffect } from "../terrain/terrain-geometry";
import { MYCELIUM_SETTINGS } from "./mycelium-settings";
import fragmentShader from "./soil-opening.frag.glsl?raw";
import vertexShader from "./soil-opening.vert.glsl?raw";

const SOIL_OPENING_CACHE_KEY = "connections-soil-opening-v3";

/** How much of the ground something else already grows on, 0..1. */
export type GroundCoverSampler = (worldX: number, worldZ: number) => number;

/**
 * The sense strength drives the opening, so the ground closes again exactly as
 * the web fades: one intensity, one gesture. The uniform object is shared with
 * the module that created it, which is what lets `setIntensity` reach both the
 * web material and the ground in one assignment.
 */
export function createSoilOpening(
  intensityUniform: { value: number },
  coverAt: GroundCoverSampler,
): TerrainMaterialEffect {
  const uniforms = {
    connectionsSoilOpening: intensityUniform,
    connectionsSoilBareOpacity: {
      value: MYCELIUM_SETTINGS.soilBareOpacity,
    },
    connectionsSoilCoveredOpacity: {
      value: MYCELIUM_SETTINGS.soilCoveredOpacity,
    },
  };

  return {
    coverAt,
    applyTo: (material) => {
      // The ground has to join the transparent pass for its alpha to mean
      // anything. It keeps writing depth, so what stands behind a hill is
      // still hidden by it; only the web, which draws ahead of the ground,
      // comes through.
      material.transparent = true;
      applyShaderPatch(material, {
        cacheKey: SOIL_OPENING_CACHE_KEY,
        uniforms,
        vertexHeader: vertexShader,
        vertexAnchor: "#include <begin_vertex>",
        vertexCall: "passConnectionsSoil();",
        fragmentHeader: fragmentShader,
        colorFragmentCall: "openConnectionsSoil(diffuseColor);",
      });
    },
  };
}
