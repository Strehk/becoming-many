/**
 * Purpose: Create magnetic-field stripes that decorate a Terrain material.
 * Context: Magnetic perception must combine with existing ground presentations.
 * Responsibility: Configure stripe uniforms, shader injection, animation, validation, and cache identity.
 * Boundary: Terrain owns geometry and material; base ground color, Grass, and sky remain independent.
 */

import type { MeshBasicMaterial } from "three";
import { Color, MathUtils, Vector2 } from "three";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import fragmentShader from "./magnetic-sense.frag.glsl?raw";
import vertexShader from "./magnetic-sense.vert.glsl?raw";

const MAGNETIC_SENSE_CACHE_KEY = "magnetic-sense-v1";
const ANIMATION_LOOP_SECONDS = 60;

const LINE_COLOR = new Color(0xd97819);
const PULSE_COLOR = new Color(0xf9b33c);

export interface MagneticSenseParameters {
  readonly fieldDirectionDegreesFromNorth: number;
  readonly lineSpacingMeters: number;
  readonly lineWidthMeters: number;
  readonly pulseWidthMeters: number;
  readonly lineOpacity: number;
  readonly flowSpeedMetersPerSecond: number;
  readonly intensity: number;
}

export interface MagneticSenseEffect {
  readonly applyTo: (material: MeshBasicMaterial) => void;
  readonly update: (deltaSeconds: number) => void;
}

/** Create a stripe effect that preserves the Terrain material's base color. */
export function createMagneticSense(
  parameters: MagneticSenseParameters,
): MagneticSenseEffect {
  validateMagneticSenseParameters(parameters);
  const timeUniform = { value: 0 };
  const directionUniform = {
    value: getFieldDirection(parameters.fieldDirectionDegreesFromNorth),
  };
  const uniforms = {
    magneticTime: timeUniform,
    magneticLineSpacing: { value: parameters.lineSpacingMeters },
    magneticLineWidth: { value: parameters.lineWidthMeters },
    magneticPulseWidth: { value: parameters.pulseWidthMeters },
    magneticLineOpacity: { value: parameters.lineOpacity },
    magneticFlowSpeed: { value: parameters.flowSpeedMetersPerSecond },
    magneticIntensity: { value: parameters.intensity },
    magneticFieldDirection: directionUniform,
    magneticLineColor: { value: LINE_COLOR },
    magneticPulseColor: { value: PULSE_COLOR },
  };
  return {
    applyTo: (material) => {
      applyShaderPatch(material, {
        cacheKey: MAGNETIC_SENSE_CACHE_KEY,
        uniforms,
        vertexHeader: vertexShader,
        vertexAnchor: "#include <begin_vertex>",
        vertexCall: "passMagneticWorldPosition(transformed);",
        fragmentHeader: fragmentShader,
        colorFragmentCall:
          "diffuseColor.rgb = applyMagneticLines(diffuseColor.rgb);",
      });
    },
    update: (deltaSeconds) => {
      timeUniform.value =
        (timeUniform.value + deltaSeconds) % ANIMATION_LOOP_SECONDS;
    },
  };
}

function getFieldDirection(degreesFromNorth: number): Vector2 {
  const angle = MathUtils.degToRad(degreesFromNorth);
  return new Vector2(Math.sin(angle), Math.cos(angle));
}

function validateMagneticSenseParameters(
  parameters: MagneticSenseParameters,
): void {
  const positiveValues = [
    parameters.lineSpacingMeters,
    parameters.lineWidthMeters,
    parameters.pulseWidthMeters,
  ];
  if (!Number.isFinite(parameters.fieldDirectionDegreesFromNorth)) {
    throw new RangeError("Magnetic field direction must be finite");
  }
  if (!positiveValues.every(isPositiveFinite)) {
    throw new RangeError(
      "Magnetic line dimensions must be positive and finite",
    );
  }
  if (parameters.pulseWidthMeters > parameters.lineWidthMeters) {
    throw new RangeError("Magnetic pulse must fit inside its line");
  }
  if (!isNormalized(parameters.lineOpacity)) {
    throw new RangeError("Magnetic line opacity must be between zero and one");
  }
  const animationValues = [
    parameters.flowSpeedMetersPerSecond,
    parameters.intensity,
  ];
  if (!animationValues.every(isNonNegativeFinite)) {
    throw new RangeError(
      "Magnetic animation values must be finite and non-negative",
    );
  }
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isNormalized(value: number): boolean {
  return isNonNegativeFinite(value) && value <= 1;
}
