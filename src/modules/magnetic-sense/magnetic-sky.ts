/**
 * Purpose: Show the magnetic field direction as a horizon glow on a sky dome.
 * Context: The long-distance orientation cue must stay readable at any flight altitude.
 * Responsibility: Own the dome mesh lifecycle and follow the camera each frame.
 * Boundary: Field direction and intensity uniforms arrive shared from Magnetic Sense.
 */

import type { PerspectiveCamera, Scene, Vector2 } from "three";
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from "three";
import type { WorldModule } from "../../world/module-runtime";
import { MAGNETIC_SENSE_SETTINGS } from "./magnetic-sense-settings";
import fragmentShader from "./magnetic-sky.frag.glsl?raw";
import vertexShader from "./magnetic-sky.vert.glsl?raw";

export interface MagneticSkyOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** The carried level haze the dome shows everywhere outside the glow. */
  readonly hazeColor: number;
  readonly glowColor: number;
  /** Shared with the terrain stripes so both consumers agree on the field. */
  readonly fieldDirectionUniform: { readonly value: Vector2 };
  /** Shared with the terrain stripes; a future dramaturgy driver writes it. */
  readonly intensityUniform: { readonly value: number };
}

interface MagneticSkyResources {
  readonly dome: Mesh<SphereGeometry, ShaderMaterial>;
}

interface MagneticSkyState {
  currentResources: MagneticSkyResources | undefined;
}

/** Create the camera-following horizon-glow dome as a world module. */
export function createMagneticSkyModule(
  options: MagneticSkyOptions,
): WorldModule {
  const state: MagneticSkyState = { currentResources: undefined };

  return {
    load: () => loadMagneticSky(state, options),
    activate: () => setMagneticSkyVisible(state, true),
    update: () => followCamera(state, options.camera),
    deactivate: () => setMagneticSkyVisible(state, false),
    unload: () => unloadMagneticSky(state, options.scene),
  };
}

function loadMagneticSky(
  state: MagneticSkyState,
  options: MagneticSkyOptions,
): void {
  const sky = MAGNETIC_SENSE_SETTINGS.sky;
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
      magneticFieldDirection: options.fieldDirectionUniform,
      magneticIntensity: options.intensityUniform,
      magneticSkyHazeColor: { value: new Color(options.hazeColor) },
      magneticSkyGlowColor: { value: new Color(options.glowColor) },
      magneticSkyGlowElevationSpan: { value: sky.glowElevationSpan },
      magneticSkyBelowHorizonElevation: { value: sky.belowHorizonElevation },
      magneticSkyAzimuthExponent: { value: sky.glowAzimuthExponent },
    },
  });
  const dome = new Mesh(geometry, material);
  // Draw first in the opaque pass so everything else paints over the glow.
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  // Loading happens before the first render. Keep every object hidden until
  // the module lifecycle activates it.
  dome.visible = false;
  dome.position.copy(options.camera.position);
  options.scene.add(dome);
  state.currentResources = { dome };
}

function followCamera(
  state: MagneticSkyState,
  camera: PerspectiveCamera,
): void {
  // Reading the camera position is WebXR-safe; only writes bypass the rig.
  // Following the full position keeps the horizon band at eye level.
  state.currentResources?.dome.position.copy(camera.position);
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
