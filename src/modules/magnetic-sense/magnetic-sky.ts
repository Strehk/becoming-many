/**
 * Purpose: Own the camera-following dome the magnetic sky is painted on.
 * Context: The orientation cue must stay readable at any flight altitude and heading.
 * Responsibility: Own the mesh and material lifecycle and follow the camera each frame.
 * Boundary: Field axis, intensity, and time uniforms arrive shared from Magnetic Sense.
 */

import type { Color, Scene, Vector3 } from "three";
import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { MAGNETIC_SENSE_SETTINGS } from "./magnetic-sense-settings";
import fragmentShader from "./magnetic-sky.frag.glsl?raw";
import vertexShader from "./magnetic-sky.vert.glsl?raw";

/** The dome's four resolved colors; the horizon arrives as a shared uniform. */
export interface MagneticSkyColors {
  readonly zenith: Color;
  readonly north: Color;
  readonly south: Color;
  /** Grain color on the ring between the poles, from the module settings. */
  readonly neutral: Color;
}

export interface MagneticSkyOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  /**
   * The haze the dome meets at the horizon. Shared so a show can keep it on
   * the live background while that background lerps between world states; a
   * static run never writes it after creation.
   */
  readonly hazeColorUniform: { readonly value: Color };
  /** The resolved palette; Magnetic Sense owns the hex-to-color conversion. */
  readonly colors: MagneticSkyColors;
  /** Noise drift in units per second, derived from the module settings. */
  readonly driftVelocity: Vector3;
  /** Shared so the show driver steers the complete sense through one value. */
  readonly fieldAxisUniform: { readonly value: Vector3 };
  /** Shared for the same reason; fades the shimmer back into the plain sky. */
  readonly intensityUniform: { readonly value: number };
  /** Shared and wrapped by Magnetic Sense, which owns the animation clock. */
  readonly timeUniform: { readonly value: number };
}

interface MagneticSkyResources {
  readonly dome: Mesh<SphereGeometry, ShaderMaterial>;
}

interface MagneticSkyState {
  currentResources: MagneticSkyResources | undefined;
}

/** Create the camera-following shimmer dome as a world module. */
export function createMagneticSkyModule(
  options: MagneticSkyOptions,
): WorldModule {
  const state: MagneticSkyState = { currentResources: undefined };

  return {
    load: () => loadMagneticSky(state, options),
    activate: () => setMagneticSkyVisible(state, true),
    update: () => followCamera(state, options.viewpoint),
    deactivate: () => setMagneticSkyVisible(state, false),
    unload: () => unloadMagneticSky(state, options.scene),
  };
}

function loadMagneticSky(
  state: MagneticSkyState,
  options: MagneticSkyOptions,
): void {
  const sky = MAGNETIC_SENSE_SETTINGS.sky;
  const shimmer = MAGNETIC_SENSE_SETTINGS.shimmer;
  const geometry = new SphereGeometry(
    sky.domeRadiusMeters,
    sky.widthSegments,
    sky.heightSegments,
  );
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: BackSide,
    // The dome stays an opaque backdrop: later opaque geometry depth-tests
    // against an empty buffer and paints over it.
    depthWrite: false,
    uniforms: {
      magneticFieldAxis: options.fieldAxisUniform,
      magneticIntensity: options.intensityUniform,
      magneticTime: options.timeUniform,
      magneticHorizonColor: options.hazeColorUniform,
      magneticZenithColor: { value: options.colors.zenith },
      magneticNorthColor: { value: options.colors.north },
      magneticSouthColor: { value: options.colors.south },
      magneticNeutralColor: { value: options.colors.neutral },
      magneticDriftVelocity: { value: options.driftVelocity },
      magneticGrainFrequency: { value: shimmer.grainFrequency },
      magneticBaseAmount: { value: shimmer.baseAmount },
      magneticPoleAmount: { value: shimmer.poleAmount },
      magneticPoleWidth: { value: shimmer.poleWidthExponent },
      magneticContrast: { value: shimmer.contrast },
      magneticIridescence: { value: shimmer.iridescence },
      magneticBreathe: { value: shimmer.breathe },
      magneticStretch: { value: shimmer.stretch },
    },
  });
  const dome = new Mesh(geometry, material);
  // Draw first in the opaque pass so everything else paints over the sky.
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  // Loading happens before the first render. Keep every object hidden until
  // the module lifecycle activates it.
  dome.visible = false;
  dome.position.copy(options.viewpoint.worldPosition);
  options.scene.add(dome);
  state.currentResources = { dome };
}

function followCamera(state: MagneticSkyState, viewpoint: Viewpoint): void {
  // The viewpoint, never the camera: under the rig the camera's own
  // position is the head's offset within it, not a world position.
  // Following the full position keeps the horizon band at eye level.
  state.currentResources?.dome.position.copy(viewpoint.worldPosition);
}

function setMagneticSkyVisible(
  state: MagneticSkyState,
  visible: boolean,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  resources.dome.visible = visible;
}

function unloadMagneticSky(state: MagneticSkyState, scene: Scene): void {
  const resources = state.currentResources;
  if (!resources) return;

  state.currentResources = undefined;
  scene.remove(resources.dome);
  resources.dome.geometry.dispose();
  resources.dome.material.dispose();
}
