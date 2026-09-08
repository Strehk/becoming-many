/**
 * Purpose: Connect the Motion Sense effect to the shared world lifecycle.
 * Context: Movement becomes visible through moving actors printing fading motion trails.
 * Responsibility: Compose the actor simulations and trail rings, drive printing, and dispose.
 * Boundary: Simulation, buffers, and materials live beside this file; siblings stay untouched.
 */

import type { Scene } from "three";
import {
  disposeGltfAssets,
  type GltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  BIRD_BODY_ASSET,
  type BirdBodies,
  createBirdBodies,
} from "./bird-bodies";
import {
  type BirdFlocks,
  createBirdFlocks,
  getBirdCount,
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
  /**
   * The loaded bird model, and what the show fades it through. Absent for a
   * level that authors no bird bodies, and for one composed without a show:
   * the trace is the sense, and a body only ever joins it. The module is
   * handed the whole asset set rather than one model because it owns the
   * set's lifecycle and releases it on unload.
   */
  readonly birdBody?: {
    readonly assets: GltfAssets;
    readonly effects: readonly UnlitMaterialEffect[];
  };
}

/** One actor's position stream paired with the ring it prints into. */
interface MotionTrailPrinter {
  readonly source: MotionPointSource;
  readonly trail: MotionTrailBuffer;
}

interface MotionSenseResources {
  readonly flySwarms: FlySwarms;
  readonly birdBodies: BirdBodies | undefined;
  readonly birdFlocks: BirdFlocks | undefined;
  readonly printers: readonly MotionTrailPrinter[];
}

interface MotionSenseState {
  currentResources: MotionSenseResources | undefined;
  /** Both must hold for a body to be drawn: the module up, and heat seen. */
  isActive: boolean;
  hasBodyPresence: boolean;
}

/** The moving actor groups this module simulates. */
export type MotionActorGroup = "birds" | "flies";

/** The module beside its runtime sense driver. */
export interface MotionSenseModuleHandle {
  readonly module: WorldModule;
  /** Drive the sense strength at runtime; flies and trails share the value. */
  readonly setIntensity: (intensity: number) => void;

  /**
   * How present the bird bodies are, 0..1. The flight never changes: this
   * only decides whether the bodies flying it can be seen, which is the heat
   * view's business rather than the motion sense's.
   */
  readonly setBodyPresence: (presence: number) => void;

  /**
   * Tightly packed world xyz triples, one per live cloud of the group: where
   * the flocks and swarms are, not where their individual actors are. Empty
   * while the module is unloaded, and for birds a level never authored — the
   * caller places sound on what exists and stays silent about the rest.
   */
  readonly readActorCenters: (group: MotionActorGroup) => Float32Array;
}

/** Answer for a group with nothing in the world; shared, never written. */
const NO_CENTERS = new Float32Array(0);

export function createMotionSenseModule(
  options: MotionSenseModuleOptions,
): MotionSenseModuleHandle {
  const senseFadeUniform = { value: 1 };
  const state: MotionSenseState = {
    currentResources: undefined,
    isActive: false,
    hasBodyPresence: true,
  };

  return {
    module: {
      load: () => loadMotionSense(state, options, senseFadeUniform),
      activate: () => setMotionSenseVisible(state, true),
      update: (deltaSeconds) => updateMotionSense(state, options, deltaSeconds),
      deactivate: () => setMotionSenseVisible(state, false),
      unload: () => unloadMotionSense(state, options),
    },
    setIntensity: (intensity) => {
      senseFadeUniform.value = intensity;
    },
    setBodyPresence: (presence) => {
      state.hasBodyPresence = presence > 0;
      applyBirdBodyVisibility(state);
    },
    readActorCenters: (group) => readActorCenters(state, group),
  };
}

function readActorCenters(
  state: MotionSenseState,
  group: MotionActorGroup,
): Float32Array {
  const resources = state.currentResources;
  if (!resources) return NO_CENTERS;

  return group === "flies"
    ? resources.flySwarms.readSwarmCenters()
    : (resources.birdFlocks?.getFlockCenters() ?? NO_CENTERS);
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

  // A flock is a trace first: the bodies join only where a level authors
  // them, and even then a show decides when they may be seen.
  const birdAsset = options.birdBody?.assets.get(BIRD_BODY_ASSET.id);
  const birdBodies =
    birdFlocks && parameters.birds?.body && options.birdBody && birdAsset
      ? createBirdBodies({
          scene,
          asset: birdAsset,
          appearance: parameters.birds.body,
          birdCount: getBirdCount(parameters.birds),
          effects: options.birdBody.effects,
        })
      : undefined;

  // Loading happens before the first render. Keep every object hidden until
  // the module lifecycle activates it.
  flySwarms.points.visible = false;
  scene.add(flySwarms.points);
  for (const printer of printers) {
    printer.trail.points.visible = false;
    scene.add(printer.trail.points);
  }
  state.currentResources = { flySwarms, birdFlocks, birdBodies, printers };
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
  // Placed from the same stream that prints the trace, so a body is always
  // exactly where the trace says a bird is.
  if (resources.birdFlocks && resources.birdBodies) {
    resources.birdBodies.update(resources.birdFlocks.getBodyStream());
  }
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
  state.isActive = visible;
  applyBirdBodyVisibility(state);
}

/** A body is drawn only while the sense stands and something reveals it. */
function applyBirdBodyVisibility(state: MotionSenseState): void {
  state.currentResources?.birdBodies?.setVisible(
    state.isActive && state.hasBodyPresence,
  );
}

function unloadMotionSense(
  state: MotionSenseState,
  options: MotionSenseModuleOptions,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  const scene = options.scene;
  state.currentResources = undefined;
  resources.birdBodies?.dispose();
  // The pool draws a clone of the model; the loaded source is this module's
  // to release too, exactly as the animal, rock and vegetation pools do.
  if (options.birdBody) disposeGltfAssets(options.birdBody.assets);
  scene.remove(resources.flySwarms.points);
  resources.flySwarms.dispose();
  for (const printer of resources.printers) {
    scene.remove(printer.trail.points);
    printer.trail.dispose();
  }
}
