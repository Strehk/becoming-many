/**
 * Purpose: Create the semantic low-to-high color presentation for Terrain.
 * Context: Design levels need an inexpensive ground gradient independent from zone diagnostics.
 * Responsibility: Configure one unlit material shader patch from authored colors.
 * Boundary: Zone Visualizer, geometry streaming, textures, and material effects stay separate.
 */

import { Color, MeshBasicMaterial } from "three";
import { getElevationRange } from "../../world-surface/height-field";
import type { WorldSurfaceSettings } from "../../world-surface/surface-settings";
import type { WorldSurface } from "../../world-surface/world-surface";
import fragmentShader from "./terrain-colors.frag.glsl?raw";
import vertexShader from "./terrain-colors.vert.glsl?raw";
import type { TerrainPresentation } from "./terrain-geometry";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_DIFFUSE_COLOR = "vec4 diffuseColor = vec4( diffuse, opacity );";
const TERRAIN_COLORS_CACHE_KEY = "terrain-colors-v1";

export interface TerrainColors {
  readonly lowElevationColor: number;
  readonly highElevationColor: number;
  readonly waterColor: number;
}

export function createTerrainColors(
  colors: TerrainColors,
  settings: WorldSurfaceSettings,
  worldSurface: WorldSurface,
): TerrainPresentation {
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const { minimumElevation, maximumElevation } = getElevationRange(settings);

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      terrainLowElevationColor: { value: new Color(colors.lowElevationColor) },
      terrainHighElevationColor: {
        value: new Color(colors.highElevationColor),
      },
      terrainWaterColor: { value: new Color(colors.waterColor) },
      terrainMinimumElevation: { value: minimumElevation },
      terrainMaximumElevation: { value: maximumElevation },
    });
    shader.vertexShader = shader.vertexShader
      .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${vertexShader}`)
      .replace(
        THREE_POSITION_SHADER,
        `${THREE_POSITION_SHADER}\npassTerrainElevationColor(transformed);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${fragmentShader}`)
      .replace(
        THREE_DIFFUSE_COLOR,
        "vec4 diffuseColor = vec4(getTerrainColor(), opacity);",
      );
  };
  material.customProgramCacheKey = () => TERRAIN_COLORS_CACHE_KEY;

  return {
    material,
    conditionsAt: worldSurface.zoneConditionsAt,
  };
}
