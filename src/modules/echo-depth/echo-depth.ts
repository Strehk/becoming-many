/**
 * Purpose: Turn any unlit surface color into the Level 03 depth response.
 * Context: Echolocation must decorate Terrain, Vegetation, and Rocks in their own passes.
 * Responsibility: Configure shared ramp uniforms, shader injection, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; base colors below full intensity stay theirs.
 */

import { Color, Vector3 } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import fragmentShader from "./echo-depth.frag.glsl?raw";
import vertexShader from "./echo-depth.vert.glsl?raw";
import {
  ECHO_DEPTH_SETTINGS,
  type EchoDepthParameters,
} from "./echo-depth-settings";
import waterFragmentShader from "./echo-depth-water.frag.glsl?raw";
import waterVertexShader from "./echo-depth-water.vert.glsl?raw";

export type { EchoDepthParameters } from "./echo-depth-settings";

const ECHO_DEPTH_CACHE_KEY = "echo-depth-v2";
const ECHO_DEPTH_WATER_CACHE_KEY = "echo-depth-water-v1";

export type EchoDepthEffect = UnlitMaterialEffect;

/**
 * The Terrain variant. It is the same ramp, and additionally asks for the
 * per-vertex water measure when the level authors a water color.
 */
export interface TerrainEchoDepthEffect extends EchoDepthEffect {
  readonly needsSurfaceWater?: true;
}

export interface EchoDepthEffects {
  /** Terrain: the only sensed surface the river can run across. */
  readonly terrain: TerrainEchoDepthEffect;

  /** Vegetation, Rocks, and Grass: the pure ramp, with no water to show. */
  readonly surfaces: EchoDepthEffect;
}

/** Create one shared depth ramp; apply it to every sensed material. */
export function createEchoDepth(
  parameters: EchoDepthParameters,
): EchoDepthEffects {
  validateEchoDepthParameters(parameters);
  // One uniform object each, shared by every patched program, so a future
  // runtime intensity driver reaches all consumers through a single value.
  const uniforms = {
    echoIntensity: { value: parameters.intensity },
    echoNearDistance: { value: parameters.nearDistanceMeters },
    echoFarDistance: { value: parameters.farDistanceMeters },
    echoRampStops: {
      value: new Vector3(
        ECHO_DEPTH_SETTINGS.nearShadeStopFraction,
        ECHO_DEPTH_SETTINGS.midStopFraction,
        ECHO_DEPTH_SETTINGS.farStopFraction,
      ),
    },
    echoNearColor: { value: new Color(parameters.colors.nearColor) },
    echoNearShadeColor: { value: new Color(parameters.colors.nearShadeColor) },
    echoMidColor: { value: new Color(parameters.colors.midColor) },
    echoFarColor: { value: new Color(parameters.colors.farColor) },
    echoHazeColor: { value: new Color(parameters.colors.hazeColor) },
  };
  const surfaces = createRampEffect(uniforms);

  if (parameters.waterColor === undefined) {
    // Without an authored water color both consumers compile the identical
    // program, and Terrain streams no water attribute.
    return { terrain: surfaces, surfaces };
  }

  return {
    terrain: createWaterRampEffect({
      ...uniforms,
      echoWaterColor: { value: new Color(parameters.waterColor) },
    }),
    surfaces,
  };
}

type EchoDepthUniforms = Readonly<Record<string, { value: unknown }>>;

function createRampEffect(uniforms: EchoDepthUniforms): EchoDepthEffect {
  return {
    applyTo: (material) => {
      applyShaderPatch(material, {
        cacheKey: ECHO_DEPTH_CACHE_KEY,
        uniforms,
        vertexHeader: vertexShader,
        vertexAnchor: "#include <project_vertex>",
        vertexCall: "passEchoDepth(mvPosition);",
        fragmentHeader: fragmentShader,
        colorFragmentCall:
          "diffuseColor.rgb = applyEchoDepth(diffuseColor.rgb);",
      });
    },
  };
}

/** The same ramp, with the water surface held out of it. */
function createWaterRampEffect(
  uniforms: EchoDepthUniforms,
): TerrainEchoDepthEffect {
  return {
    needsSurfaceWater: true,
    applyTo: (material) => {
      applyShaderPatch(material, {
        cacheKey: ECHO_DEPTH_WATER_CACHE_KEY,
        uniforms,
        vertexHeader: `${vertexShader}\n${waterVertexShader}`,
        vertexAnchor: "#include <project_vertex>",
        vertexCall: "passEchoDepth(mvPosition);\npassEchoWater();",
        fragmentHeader: `${fragmentShader}\n${waterFragmentShader}`,
        colorFragmentCall:
          "diffuseColor.rgb = applyEchoDepthWithWater(diffuseColor.rgb);",
      });
    },
  };
}

function validateEchoDepthParameters(parameters: EchoDepthParameters): void {
  if (!isNormalized(parameters.intensity)) {
    throw new RangeError("Echo depth intensity must be between zero and one");
  }
  const distances = [
    parameters.nearDistanceMeters,
    parameters.farDistanceMeters,
  ];
  if (
    !distances.every(isPositiveFinite) ||
    parameters.nearDistanceMeters >= parameters.farDistanceMeters
  ) {
    throw new RangeError(
      "Echo depth distances must be positive with near below far",
    );
  }
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNormalized(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
