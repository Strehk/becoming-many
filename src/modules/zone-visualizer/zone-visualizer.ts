/**
 * Purpose: Render hard diagnostic colors from continuous world-zone conditions.
 * Context: Landscape zones must be inspectable without turning vertex colors into world data.
 * Responsibility: Configure one unlit terrain material that classifies each rendered pixel.
 * Boundary: World Surface calculates conditions; Terrain owns geometry, streaming, and disposal.
 */

import { Color, MeshBasicMaterial } from "three";
import type { WorldSurface } from "../../world-surface/world-surface";
import type { ZoneId, ZoneSettings } from "../../world-surface/zone-settings";
import zoneFragmentShader from "./zone-visualizer.frag.glsl?raw";
import zoneVertexShader from "./zone-visualizer.vert.glsl?raw";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_DIFFUSE_COLOR = "vec4 diffuseColor = vec4( diffuse, opacity );";
const ZONE_VISUALIZER_CACHE_KEY = "zone-visualizer-v1";

export const ZONE_COLOR_VALUES: Record<ZoneId, number> = {
  water: 0x4f93c2,
  meadow: 0x4ea96b,
  coniferForest: 0xe0ad3f,
  deciduousForest: 0xd94b45,
  shrubSlope: 0x9b4dca,
};

export interface ZoneVisualization {
  readonly material: MeshBasicMaterial;
  readonly conditionsAt: WorldSurface["zoneConditionsAt"];
}

/** Create diagnostic presentation data that Terrain takes ownership of. */
export function createZoneVisualizer(
  worldSurface: WorldSurface,
  settings: ZoneSettings,
): ZoneVisualization {
  const material = new MeshBasicMaterial({ color: 0xffffff });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.zoneConiferForestThreshold = {
      value: settings.coniferForestThreshold,
    };
    shader.uniforms.zoneDeciduousForestThreshold = {
      value: settings.deciduousForestThreshold,
    };
    shader.uniforms.zoneShrubSlopeThreshold = {
      value: settings.shrubSlopeThreshold,
    };
    shader.uniforms.zoneWaterColor = {
      value: new Color(ZONE_COLOR_VALUES.water),
    };
    shader.uniforms.zoneMeadowColor = {
      value: new Color(ZONE_COLOR_VALUES.meadow),
    };
    shader.uniforms.zoneConiferForestColor = {
      value: new Color(ZONE_COLOR_VALUES.coniferForest),
    };
    shader.uniforms.zoneDeciduousForestColor = {
      value: new Color(ZONE_COLOR_VALUES.deciduousForest),
    };
    shader.uniforms.zoneShrubSlopeColor = {
      value: new Color(ZONE_COLOR_VALUES.shrubSlope),
    };

    shader.vertexShader = shader.vertexShader
      .replace(
        THREE_COMMON_SHADER,
        `${THREE_COMMON_SHADER}\n${zoneVertexShader}`,
      )
      .replace(
        THREE_POSITION_SHADER,
        `${THREE_POSITION_SHADER}\npassZoneConditionsToFragment();`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        THREE_COMMON_SHADER,
        `${THREE_COMMON_SHADER}\n${zoneFragmentShader}`,
      )
      .replace(
        THREE_DIFFUSE_COLOR,
        "vec4 diffuseColor = vec4(getZoneColor(), opacity);",
      );
  };

  material.customProgramCacheKey = () => ZONE_VISUALIZER_CACHE_KEY;

  return {
    material,
    conditionsAt: worldSurface.zoneConditionsAt,
  };
}
