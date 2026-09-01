/**
 * Purpose: Turn any unlit surface color into the Level 03 depth response.
 * Context: Echolocation must decorate Terrain, Vegetation, and Rocks in their own passes.
 * Responsibility: Configure shared ramp uniforms, shader injection, validation, and cache identity.
 * Boundary: Consumers own materials and geometry; base colors below full intensity stay theirs.
 */

import { Color, Vector3 } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import { isNormalized, isPositiveFinite } from "../../utils/number-ranges";
import fragmentShader from "./echo-depth.frag.glsl?raw";
import vertexShader from "./echo-depth.vert.glsl?raw";
import {
  ECHO_DEPTH_SETTINGS,
  type EchoDepthParameters,
} from "./echo-depth-settings";

export type { EchoDepthParameters } from "./echo-depth-settings";

const ECHO_DEPTH_CACHE_KEY = "echo-depth-v2";

/**
 * Deliberately no runtime intensity driver: during a show the surfaces the
 * ramp decorates already dissolve into the background through the World Fade,
 * so the depth response materializes and vanishes with them at full strength.
 * Fading the ramp as well would wash the world toward its base colors on top
 * of that dissolve — a double fade reading as a different, muddier gesture.
 */
export type EchoDepthEffect = UnlitMaterialEffect;

/** Create one shared depth ramp; apply it to every sensed material. */
export function createEchoDepth(
  parameters: EchoDepthParameters,
): EchoDepthEffect {
  validateEchoDepthParameters(parameters);
  // One uniform object each, shared by every patched program, so every
  // consumer answers to the same authored values.
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
