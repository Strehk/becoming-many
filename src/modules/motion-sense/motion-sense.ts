/**
 * Purpose: Connect the Motion Sense effect to the shared world lifecycle.
 * Context: Movement becomes visible through moving actors printing fading motion trails.
 * Responsibility: Compose the actor simulations and trail rings, drive printing, and dispose.
 * Boundary: Simulation, buffers, and materials live beside this file; siblings stay untouched.
 */

import type { Scene } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  type BirdFlocks,
  createBirdFlocks,
  getBirdPointCount,
} from "./bird-flocks";
import { createFlySwarms, type FlySwarms } from "./fly-swarms";
import type { MotionSenseParameters } from "./motion-sense-settings";
import {
  createMotionTrailBuffer,
  type MotionTrailBuffer,
} from "./motion-trail-buffer";

export type { MotionSenseParameters } from "./motion-sense-settings";

/**
 * The seam every moving actor prints trails through: the module pairs each
 * source's position stream with its own trail ring. Fly swarms and bird
 * flocks implement it today; further actors join without touching either.
 */
// fallow-ignore-next-line unused-type
export interface MotionPointSource {
  /** Tightly packed world xyz triples sampled once per rendered frame. */
  readonly getWorldPositions: () => Float32Array;
}

export interface MotionSenseModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly parameters: MotionSenseParameters;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
}

/** One actor's position stream paired with the ring it prints into. */
interface MotionTrailPrinter {
  readonly source: MotionPointSource;
  readonly trail: MotionTrailBuffer;
}

interface MotionSenseResources {
  readonly flySwarms: FlySwarms;
  readonly birdFlocks: BirdFlocks | undefined;
  readonly printers: readonly MotionTrailPrinter[];
}

interface MotionSenseState {
  currentResources: MotionSenseResources | undefined;
}

/** The module beside its runtime sense driver. */
export interface MotionSenseModuleHandle {
  readonly module: WorldModule;
  /** Drive the sense strength at runtime; flies and trails share the value. */
  readonly setIntensity: (intensity: number) => void;
}

export function createMotionSenseModule(
  options: MotionSenseModuleOptions,
): MotionSenseModuleHandle {
  const senseFadeUniform = { value: 1 };
  const state: MotionSenseState = { currentResources: undefined };

  return {
    module: {
      load: () => loadMotionSense(state, options, senseFadeUniform),
      activate: () => setMotionSenseVisible(state, true),
      update: (deltaSeconds) => updateMotionSense(state, options, deltaSeconds),
      deactivate: () => setMotionSenseVisible(state, false),
      unload: () => unloadMotionSense(state, options.scene),
    },
    setIntensity: (intensity) => {
      senseFadeUniform.value = intensity;
    },
  };
}

function loadMotionSense(
  state: MotionSenseState,
  options: MotionSenseModuleOptions,
  senseFadeUniform: { readonly value: number },
): void {
  const { viewpoint, scene, parameters } = options;
  const flySwarms = createFlySwarms({
    parameters,
    groundYAt: options.groundYAt,
    zoneAt: options.zoneAt,
    initialPlayerX: viewpoint.worldPosition.x,
    initialPlayerZ: viewpoint.worldPosition.z,
    senseFadeUniform,
  });
  const printers: MotionTrailPrinter[] = [
    {
      source: flySwarms,
      trail: createMotionTrailBuffer({
        pointCount:
          parameters.swarms.swarmCount * parameters.swarms.fliesPerSwarm,
        trail: parameters.trail,
        appearance: parameters.appearance,
        intensity: parameters.intensity,
        senseFadeUniform,
      }),
    },
  ];

  // Bird bodies stay invisible (perception-only actors): only their trail
  // ring joins the scene beside the visible fly specks.
  const birdFlocks = parameters.birds
    ? createBirdFlocks({
        birds: parameters.birds,
        groundYAt: options.groundYAt,
        initialPlayerX: viewpoint.worldPosition.x,
        initialPlayerZ: viewpoint.worldPosition.z,
      })
    : undefined;
  if (birdFlocks && parameters.birds) {
    printers.push({
      source: birdFlocks,
      trail: createMotionTrailBuffer({
        pointCount: getBirdPointCount(parameters.birds),
        // The flocks' own ring depth; everything else about a trail — its
        // expansion, its motion gain, its fade — is one shared behavior.
        trail: {
          ...parameters.trail,
          lifetimeFrames: parameters.birds.trailLifetimeFrames,
        },
        appearance: parameters.birds.appearance,
        intensity: parameters.intensity,
        senseFadeUniform,
      }),
    });
  }

  // Loading happens before the first render. Keep every object hidden until
  // the module lifecycle activates it.
  flySwarms.points.visible = false;
  scene.add(flySwarms.points);
  for (const printer of printers) {
    printer.trail.points.visible = false;
    scene.add(printer.trail.points);
  }
  state.currentResources = { flySwarms, birdFlocks, printers };
}

function updateMotionSense(
  state: MotionSenseState,
  { viewpoint }: MotionSenseModuleOptions,
  deltaSeconds: number,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  // The viewpoint, never the camera: under the rig the camera's own
  // position is the head's offset within it, not a world position.
  resources.flySwarms.update(
    deltaSeconds,
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.z,
  );
  resources.birdFlocks?.update(
    deltaSeconds,
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.z,
  );
  for (const printer of resources.printers) {
    printer.trail.spawnFromWorldPoints(printer.source.getWorldPositions());
  }
}

function setMotionSenseVisible(
  state: MotionSenseState,
  visible: boolean,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  resources.flySwarms.points.visible = visible;
  for (const printer of resources.printers) {
    printer.trail.points.visible = visible;
  }
}

function unloadMotionSense(state: MotionSenseState, scene: Scene): void {
  const resources = state.currentResources;
  if (!resources) return;

  state.currentResources = undefined;
  scene.remove(resources.flySwarms.points);
  resources.flySwarms.dispose();
  for (const printer of resources.printers) {
    scene.remove(printer.trail.points);
    printer.trail.dispose();
  }
}
