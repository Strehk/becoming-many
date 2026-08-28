/**
 * Purpose: Connect the Motion Sense effect to the shared world lifecycle.
 * Context: Movement becomes visible through fly swarms printing fading motion trails.
 * Responsibility: Compose the fly simulation and trail ring, drive per-frame printing, and dispose.
 * Boundary: Simulation, buffers, and materials live beside this file; siblings stay untouched.
 */

import type { PerspectiveCamera, Scene } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { WorldSurface } from "../../world-surface/world-surface";
import { createFlySwarms, type FlySwarms } from "./fly-swarms";
import type { MotionSenseParameters } from "./motion-sense-settings";
import {
  createMotionTrailBuffer,
  type MotionTrailBuffer,
} from "./motion-trail-buffer";

export type { MotionSenseParameters } from "./motion-sense-settings";

/**
 * The seam for future moving actors (bird flocks) to print trails: the
 * composition root adapts their positions into one additional trail ring.
 * The fly swarms are the only source until level 04's bird decision lands.
 */
// fallow-ignore-next-line unused-type
export interface MotionPointSource {
  /** Tightly packed world xyz triples sampled once per rendered frame. */
  readonly getWorldPositions: () => Float32Array;
}

export interface MotionSenseModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly parameters: MotionSenseParameters;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
}

interface MotionSenseResources {
  readonly flySwarms: FlySwarms;
  readonly flyTrailSource: MotionPointSource;
  readonly flyTrail: MotionTrailBuffer;
}

interface MotionSenseState {
  currentResources: MotionSenseResources | undefined;
}

export function createMotionSenseModule(
  options: MotionSenseModuleOptions,
): WorldModule {
  const state: MotionSenseState = { currentResources: undefined };

  return {
    load: () => loadMotionSense(state, options),
    activate: () => setMotionSenseVisible(state, true),
    update: (deltaSeconds) => updateMotionSense(state, options, deltaSeconds),
    deactivate: () => setMotionSenseVisible(state, false),
    unload: () => unloadMotionSense(state, options.scene),
  };
}

function loadMotionSense(
  state: MotionSenseState,
  options: MotionSenseModuleOptions,
): void {
  const { camera, scene, parameters } = options;
  const flySwarms = createFlySwarms({
    parameters,
    groundYAt: options.groundYAt,
    zoneAt: options.zoneAt,
    initialPlayerX: camera.position.x,
    initialPlayerZ: camera.position.z,
  });
  const flyTrail = createMotionTrailBuffer({
    pointCount: parameters.swarms.swarmCount * parameters.swarms.fliesPerSwarm,
    parameters,
  });

  // Loading happens before the first render. Keep both objects hidden until
  // the module lifecycle activates them.
  flySwarms.points.visible = false;
  flyTrail.points.visible = false;
  scene.add(flySwarms.points);
  scene.add(flyTrail.points);
  state.currentResources = { flySwarms, flyTrailSource: flySwarms, flyTrail };
}

function updateMotionSense(
  state: MotionSenseState,
  { camera }: MotionSenseModuleOptions,
  deltaSeconds: number,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  // Reading the camera position is WebXR-safe; only writes bypass the rig.
  resources.flySwarms.update(
    deltaSeconds,
    camera.position.x,
    camera.position.z,
  );
  resources.flyTrail.spawnFromWorldPoints(
    resources.flyTrailSource.getWorldPositions(),
  );
}

function setMotionSenseVisible(
  state: MotionSenseState,
  visible: boolean,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  resources.flySwarms.points.visible = visible;
  resources.flyTrail.points.visible = visible;
}

function unloadMotionSense(state: MotionSenseState, scene: Scene): void {
  const resources = state.currentResources;
  if (!resources) return;

  state.currentResources = undefined;
  scene.remove(resources.flySwarms.points);
  scene.remove(resources.flyTrail.points);
  resources.flySwarms.dispose();
  resources.flyTrail.dispose();
}
