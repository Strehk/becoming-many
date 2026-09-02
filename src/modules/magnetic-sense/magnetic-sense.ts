/**
 * Purpose: Create magnetic field perception as the previous version's sky, hardcoded.
 * Context: The field reads as a radical-pair shimmer condensing toward the magnetic north point.
 * Responsibility: Validate the preset, derive the field axis and drift, and drive the sky clock.
 * Boundary: The sky module owns the dome and its material; terrain stays untouched.
 */

import type { Scene } from "three";
import { Color, MathUtils, Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { MagneticSenseParameters } from "./magnetic-sense-settings";
import { MAGNETIC_SENSE_SETTINGS } from "./magnetic-sense-settings";
import {
  createMagneticSkyModule,
  type MagneticSkyColors,
} from "./magnetic-sky";

export type { MagneticSenseParameters } from "./magnetic-sense-settings";

/** The module beside its runtime drivers, as every driven sense returns. */
export interface MagneticSenseModuleHandle {
  readonly module: WorldModule;
  /** Drive the sense strength at runtime; shimmer and sky share the value. */
  readonly setIntensity: (intensity: number) => void;
  /**
   * Keep the dome's horizon on the live background. The dome is an opaque
   * backdrop, so while a show lerps the clear color between world states the
   * horizon must move with it or the sky would split from the distance.
   */
  readonly setSkyBackground: (background: Color) => void;
}

export interface MagneticSenseOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  /** The carried level haze the dome meets at the horizon. */
  readonly skyHazeColor: number;
}

/** Create the shimmer dome and the shared uniforms that steer it. */
export function createMagneticSense(
  parameters: MagneticSenseParameters,
  options: MagneticSenseOptions,
): MagneticSenseModuleHandle {
  validateMagneticSenseParameters(parameters);
  // One axis, one intensity, one horizon, and one time object, so the show
  // drivers and the shader agree through single values.
  const axisUniform = { value: getFieldAxis(parameters) };
  const intensityUniform = { value: parameters.intensity };
  const hazeUniform = { value: new Color(options.skyHazeColor) };
  const timeUniform = { value: 0 };
  const loopSeconds = MAGNETIC_SENSE_SETTINGS.animationLoopSeconds;
  const sky = createMagneticSkyModule({
    scene: options.scene,
    viewpoint: options.viewpoint,
    hazeColorUniform: hazeUniform,
    colors: getSkyColors(parameters),
    driftVelocity: getDriftVelocity(),
    fieldAxisUniform: axisUniform,
    intensityUniform,
    timeUniform,
  });

  return {
    module: {
      ...sky,
      update: (deltaSeconds) => {
        timeUniform.value = (timeUniform.value + deltaSeconds) % loopSeconds;
        sky.update?.(deltaSeconds);
      },
    },
    setIntensity: (intensity) => {
      intensityUniform.value = intensity;
    },
    setSkyBackground: (background) => {
      hazeUniform.value.copy(background);
    },
  };
}

/** Resolve the authored palette once; the dome only ever sees colors. */
function getSkyColors(parameters: MagneticSenseParameters): MagneticSkyColors {
  return {
    zenith: new Color(parameters.colors.zenithColor),
    north: new Color(parameters.colors.northColor),
    south: new Color(parameters.colors.southColor),
    neutral: new Color(MAGNETIC_SENSE_SETTINGS.shimmer.neutralColor),
  };
}

/**
 * The axis pointing at the magnetic north point. North is +Z here, where the
 * previous version used −Z; declination and inclination are otherwise its own.
 */
function getFieldAxis(parameters: MagneticSenseParameters): Vector3 {
  const declination = MathUtils.degToRad(
    parameters.fieldDirectionDegreesFromNorth,
  );
  const elevation = MathUtils.degToRad(parameters.fieldElevationDegrees);
  const horizontal = Math.cos(elevation);

  return new Vector3(
    Math.sin(declination) * horizontal,
    Math.sin(elevation),
    Math.cos(declination) * horizontal,
  );
}

/** The noise drift, one heading with a vertical part, in units per second. */
function getDriftVelocity(): Vector3 {
  const shimmer = MAGNETIC_SENSE_SETTINGS.shimmer;
  const heading = MathUtils.degToRad(shimmer.driftHeadingDegrees);

  return new Vector3(
    Math.sin(heading),
    shimmer.driftVertical,
    Math.cos(heading),
  ).multiplyScalar(shimmer.driftSpeed);
}

function validateMagneticSenseParameters(
  parameters: MagneticSenseParameters,
): void {
  if (!Number.isFinite(parameters.fieldDirectionDegreesFromNorth)) {
    throw new RangeError("Magnetic field direction must be finite");
  }
  if (!isElevation(parameters.fieldElevationDegrees)) {
    throw new RangeError(
      "Magnetic field elevation must lie between the horizon and the zenith",
    );
  }
  if (!isNormalized(parameters.intensity)) {
    throw new RangeError("Magnetic intensity must be between zero and one");
  }
}

/** Below the horizon the shimmer would sit in the ground, above the zenith it wraps. */
function isElevation(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 90;
}

function isNormalized(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
