/**
 * Purpose: Turn any unlit surface color into the Level 03 depth response.
 * Context: Echolocation must decorate Terrain, Vegetation, and Rocks in their own passes.
 * Responsibility: Configure shared ramp uniforms, shader injection, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; base colors below full intensity stay theirs.
 */

import { Color, Vector3 } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import fragmentShader from "./echo-depth.frag.glsl?raw";
import vertexShader from "./echo-depth.vert.glsl?raw";
import {
  ECHO_DEPTH_SETTINGS,
  type EchoDepthParameters,
} from "./echo-depth-settings";

export type { EchoDepthParameters } from "./echo-depth-settings";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_PROJECT_SHADER = "#include <project_vertex>";
const THREE_COLOR_FRAGMENT = "#include <color_fragment>";
const ECHO_DEPTH_CACHE_KEY = "echo-depth-v2";

export type EchoDepthEffect = UnlitMaterialEffect;

/** Create one shared depth ramp; apply it to every sensed material. */
export function createEchoDepth(
  parameters: EchoDepthParameters,
): EchoDepthEffect {
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

  return {
    applyTo: (material) => {
      const compileBaseMaterial = material.onBeforeCompile.bind(material);
      const baseCacheKey = material.customProgramCacheKey();

      material.onBeforeCompile = (shader, renderer) => {
        compileBaseMaterial(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace(
            THREE_COMMON_SHADER,
            `${THREE_COMMON_SHADER}\n${vertexShader}`,
          )
          .replace(
            THREE_PROJECT_SHADER,
            `${THREE_PROJECT_SHADER}\npassEchoDepth(mvPosition);`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            THREE_COMMON_SHADER,
            `${THREE_COMMON_SHADER}\n${fragmentShader}`,
          )
          .replace(
            THREE_COLOR_FRAGMENT,
            `${THREE_COLOR_FRAGMENT}\ndiffuseColor.rgb = applyEchoDepth(diffuseColor.rgb);`,
          );
      };
      material.customProgramCacheKey = () =>
        `${baseCacheKey}:${ECHO_DEPTH_CACHE_KEY}`;
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
