/**
 * Purpose: Connect the Motion Sense effect to the shared world lifecycle.
 * Context: Movement becomes visible through moving actors printing fading motion trails.
 * Responsibility: Compose the actor simulations and trail rings, drive printing, and dispose.
 * Boundary: Simulation, buffers, and materials live beside this file; siblings stay untouched.
 */

import type { Scene } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
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
import { createRaptorBody, type RaptorBody } from "./raptor-body";
import {
  createRaptorFlight,
  RAPTOR_POINT_COUNT,
  type RaptorFlight,
} from "./raptor-flight";

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
   * The raptor's model, and what a show fades it through. Absent for a level
   * that authors only its trace, and for one composed without a show: what
   * the motion sense shows is movement, and a body only ever joins it.
   */
  readonly raptorBody?: {
    readonly asset: GLTF;
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
  readonly raptorFlight: RaptorFlight | undefined;
  readonly raptorBody: RaptorBody | undefined;
  readonly birdFlocks: BirdFlocks | undefined;
  readonly printers: readonly MotionTrailPrinter[];
}

interface MotionSenseState {
  currentResources: MotionSenseResources | undefined;
  /** Both must hold for a body to be drawn: the sense up, and warmth seen. */
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
   * Tightly packed world xyz triples, one per live cloud of the group: where
   * the flocks and swarms are, not where their individual actors are. Empty
   * while the module is unloaded, and for birds a level never authored — the
   * caller places sound on what exists and stays silent about the rest.
   */
  readonly readActorCenters: (group: MotionActorGroup) => Float32Array;

  /**
   * How present the raptor's body is, 0..1. Its ring never changes: this only
   * decides whether the bird flying it can be seen, which is the heat view's
   * business rather than the motion sense's.
   */
  readonly setBodyPresence: (presence: number) => void;
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
      unload: () => unloadMotionSense(state, options.scene),
    },
    setIntensity: (intensity) => {
      senseFadeUniform.value = intensity;
    },
    readActorCenters: (group) => readActorCenters(state, group),
    setBodyPresence: (presence) => {
      state.hasBodyPresence = presence > 0;
      applyRaptorBodyVisibility(state);
    },
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

  const birdFlocks = loadBirdFlocks(options, senseFadeUniform, printers);
  const raptorFlight = loadRaptorFlight(options, senseFadeUniform, printers);
  const raptorBody =
    raptorFlight && parameters.raptor?.body && options.raptorBody
      ? createRaptorBody({
          scene,
          asset: options.raptorBody.asset,
          appearance: parameters.raptor.body,
          effects: options.raptorBody.effects,
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
  state.currentResources = {
    flySwarms,
    birdFlocks,
    raptorFlight,
    raptorBody,
    printers,
  };
}

/** The flocks and the ring they print into, or nothing for a sky without. */
function loadBirdFlocks(
  options: MotionSenseModuleOptions,
  senseFadeUniform: { readonly value: number },
  printers: MotionTrailPrinter[],
): BirdFlocks | undefined {
  const { parameters, viewpoint } = options;
  if (!parameters.birds) return undefined;

  const birdFlocks = createBirdFlocks({
    birds: parameters.birds,
    groundYAt: options.groundYAt,
    initialPlayerX: viewpoint.worldPosition.x,
    initialPlayerZ: viewpoint.worldPosition.z,
  });
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
  return birdFlocks;
}

/**
 * The one bird that circles a place rather than the visitor, and the ring it
 * prints into. Its trace joins the same seam every other actor prints through.
 */
function loadRaptorFlight(
  options: MotionSenseModuleOptions,
  senseFadeUniform: { readonly value: number },
  printers: MotionTrailPrinter[],
): RaptorFlight | undefined {
  const { parameters, viewpoint } = options;
  if (!parameters.raptor) return undefined;

  const raptorFlight = createRaptorFlight({
    groundYAt: options.groundYAt,
    initialPlayerX: viewpoint.worldPosition.x,
    initialPlayerZ: viewpoint.worldPosition.z,
  });
  printers.push({
    source: raptorFlight,
    trail: createMotionTrailBuffer({
      pointCount: RAPTOR_POINT_COUNT,
      trail: {
        ...parameters.trail,
        lifetimeFrames: parameters.raptor.trailLifetimeFrames,
      },
      appearance: parameters.raptor.appearance,
      intensity: parameters.intensity,
      senseFadeUniform,
    }),
  });
  return raptorFlight;
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
  resources.raptorFlight?.update(
    deltaSeconds,
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.z,
  );
  // Placed from the same stream that prints its trace, so the bird is always
  // exactly where the line it drew says it is.
  if (resources.raptorFlight && resources.raptorBody) {
    resources.raptorBody.update(
      resources.raptorFlight.getBodyStream(),
      deltaSeconds,
    );
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
  applyRaptorBodyVisibility(state);
}

/** A body is drawn only while the sense stands and something reveals it. */
function applyRaptorBodyVisibility(state: MotionSenseState): void {
  state.currentResources?.raptorBody?.setVisible(
    state.isActive && state.hasBodyPresence,
  );
}

function unloadMotionSense(state: MotionSenseState, scene: Scene): void {
  const resources = state.currentResources;
  if (!resources) return;

  state.currentResources = undefined;
  resources.raptorBody?.dispose();
  scene.remove(resources.flySwarms.points);
  resources.flySwarms.dispose();
  for (const printer of resources.printers) {
    scene.remove(printer.trail.points);
    printer.trail.dispose();
  }
}
