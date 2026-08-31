/**
 * Purpose: Create magnetic field perception for the terrain and the sky.
 * Context: Magnetic perception must combine with existing ground presentations.
 * Responsibility: Share field uniforms between the terrain stripes and the sky glow.
 * Boundary: Terrain owns geometry and material; base ground color and Grass remain independent.
 */

import type { MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { Color, MathUtils, Vector2 } from "three";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import type { WorldModule } from "../../world/module-runtime";
import fragmentShader from "./magnetic-sense.frag.glsl?raw";
import vertexShader from "./magnetic-sense.vert.glsl?raw";
import type { MagneticSenseParameters } from "./magnetic-sense-settings";
import { MAGNETIC_SENSE_SETTINGS } from "./magnetic-sense-settings";
import { createMagneticSkyModule } from "./magnetic-sky";

export type { MagneticSenseParameters } from "./magnetic-sense-settings";

const MAGNETIC_SENSE_CACHE_KEY = "magnetic-sense-v1";

export interface MagneticSenseEffect {
  readonly applyTo: (material: MeshBasicMaterial) => void;
  readonly update: (deltaSeconds: number) => void;
}

export interface MagneticSenseOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** The carried haze the sky dome shows everywhere outside the glow. */
  readonly skyHazeColor: number;
}

export interface MagneticSenseEffects {
  /** Terrain material decoration; ordered by the composition root. */
  readonly terrain: MagneticSenseEffect;
  /** Camera-following horizon-glow dome; owns its scene resources. */
  readonly sky: WorldModule;
}

/** Create the stripe effect and sky cue sharing one field uniform set. */
export function createMagneticSense(
  parameters: MagneticSenseParameters,
  options: MagneticSenseOptions,
): MagneticSenseEffects {
  validateMagneticSenseParameters(parameters);
  const timeUniform = { value: 0 };
  // One direction and one intensity object reach both consumers, so a future
  // dramaturgy driver steers the whole sense through single values.
  const directionUniform = {
    value: getFieldDirection(parameters.fieldDirectionDegreesFromNorth),
  };
  const intensityUniform = { value: parameters.intensity };
  const uniforms = {
    magneticTime: timeUniform,
    magneticLineSpacing: { value: parameters.lineSpacingMeters },
    magneticLineWidth: { value: parameters.lineWidthMeters },
    magneticPulseWidth: { value: parameters.pulseWidthMeters },
    magneticLineOpacity: { value: parameters.lineOpacity },
    magneticFlowSpeed: { value: parameters.flowSpeedMetersPerSecond },
    magneticIntensity: intensityUniform,
    magneticFieldDirection: directionUniform,
    magneticLineColor: { value: new Color(parameters.colors.lineColor) },
    magneticPulseColor: { value: new Color(parameters.colors.pulseColor) },
  };
  return {
    terrain: {
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
          (timeUniform.value + deltaSeconds) %
          MAGNETIC_SENSE_SETTINGS.animationLoopSeconds;
      },
    },
    sky: createMagneticSkyModule({
      scene: options.scene,
      camera: options.camera,
      hazeColor: options.skyHazeColor,
      glowColor: parameters.colors.skyGlowColor,
      fieldDirectionUniform: directionUniform,
      intensityUniform,
    }),
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
  if (!isNonNegativeFinite(parameters.flowSpeedMetersPerSecond)) {
    throw new RangeError("Magnetic flow speed must be finite and non-negative");
  }
  if (!isNormalized(parameters.intensity)) {
    throw new RangeError("Magnetic intensity must be between zero and one");
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
