/**
 * Purpose: Print the trails of one authored swarm crossing the visitor's flight.
 * Context: A passage animal that is a swarm has no body — only its traces exist.
 * Responsibility: Own the cloud's derived positions and its own trail ring.
 * Boundary: Where and when the swarm crosses is the passage's; the ring is shared here.
 */

import { type Scene, Vector3 } from "three";
import type { WorldModule } from "../../world/module-runtime";
import { getMotionRandom } from "./motion-random";
import type { MotionSenseParameters } from "./motion-sense-settings";
import {
  createMotionTrailBuffer,
  type MotionTrailBuffer,
} from "./motion-trail-buffer";

const COMPONENTS_PER_VALUE = 3;
const TAU = Math.PI * 2;

/**
 * One reused centre. The update runs on every frame of the show whether the
 * swarm is crossing or not, so it must not allocate.
 */
const SCRATCH_CENTRE = new Vector3();

/** Fixed random channel indexes; the fly and bird streams live beside this. */
const SWARM_RANDOM_ANGLE = 12;
const SWARM_RANDOM_RADIUS = 13;
const SWARM_RANDOM_HEIGHT = 14;
const SWARM_RANDOM_FREQUENCY = 15;
const SWARM_RANDOM_PHASE = 16;
const SWARM_RANDOM_AMPLITUDE = 17;

/*
 * Mosquito buzz, carried from the swarm this passage was tuned as: fast enough
 * that a trail reads as a blur rather than as a line, and small enough that
 * the cloud keeps its shape while every point inside it never rests.
 */
const MIN_BUZZ_HERTZ = 14;
const BUZZ_HERTZ_RANGE = 14;
const MIN_BUZZ_METERS = 0.06;
const BUZZ_METERS_RANGE = 0.06;

/**
 * Where the swarm's centre is at this instant and how long it has been
 * crossing, or undefined while it is away. The seconds are what every point's
 * buzz is derived from, so the cloud is a pure function of show time like the
 * rest of a passage: a seek lands it mid-crossing rather than restarting it.
 */
export type ReadSwarmCrossing = (centre: Vector3) => number | undefined;

export interface PassageSwarmOptions {
  readonly scene: Scene;
  readonly parameters: MotionSenseParameters;
  readonly pointCount: number;
  readonly cloudRadiusMeters: number;
  readonly cloudHeightMeters: number;
  readonly readCrossing: ReadSwarmCrossing;
}

interface PassageSwarmState {
  trail: MotionTrailBuffer | undefined;
  readonly worldPositions: Float32Array;
  crossing: boolean;
}

/**
 * The swarm is its own world module rather than a part of Motion Sense, and
 * that is the point: a passage crosses *before* the sense it announces, so it
 * cannot hang on that sense's strength or its gate. It carries its own trail
 * ring at full strength, the same way the flown passages wear plain unlit
 * materials instead of the sense effects.
 */
export function createPassageSwarmModule(
  options: PassageSwarmOptions,
): WorldModule {
  const state: PassageSwarmState = {
    trail: undefined,
    worldPositions: new Float32Array(options.pointCount * COMPONENTS_PER_VALUE),
    crossing: false,
  };

  return {
    load: () => loadSwarm(state, options),
    activate: () => setSwarmVisible(state, true),
    update: () => updateSwarm(state, options),
    deactivate: () => setSwarmVisible(state, false),
    unload: () => unloadSwarm(state, options.scene),
  };
}

function loadSwarm(
  state: PassageSwarmState,
  options: PassageSwarmOptions,
): void {
  const { parameters } = options;
  const trail = createMotionTrailBuffer({
    pointCount: options.pointCount,
    trail: parameters.trail,
    appearance: parameters.appearance,
    intensity: parameters.intensity,
    // No sense fade uniform: this crossing is not the motion sense, and
    // riding its strength would hide the passage that announces it.
  });
  trail.points.visible = false;
  options.scene.add(trail.points);
  state.trail = trail;
}

function updateSwarm(
  state: PassageSwarmState,
  options: PassageSwarmOptions,
): void {
  const trail = state.trail;
  if (!trail) return;

  const centre = SCRATCH_CENTRE;
  const crossingSeconds = options.readCrossing(centre);
  if (crossingSeconds === undefined) {
    // Away: the points are left exactly where they were, so the ring keeps
    // ageing what it already holds and prints nothing new over it.
    state.crossing = false;
  } else {
    if (!state.crossing) {
      // Arriving somewhere else entirely; the ring must not draw the way here.
      trail.forgetHistory();
      state.crossing = true;
    }
    writeSwarmPositions(state.worldPositions, options, centre, crossingSeconds);
  }
  trail.spawnFromWorldPoints(state.worldPositions);
}

/**
 * Place every point of the cloud around the centre: a settled offset that
 * gives the swarm its shape, plus a buzz that never lets one rest. Both are
 * derived from the point's index and the crossing time, so nothing here
 * carries state between frames.
 */
function writeSwarmPositions(
  worldPositions: Float32Array,
  options: PassageSwarmOptions,
  centre: Vector3,
  crossingSeconds: number,
): void {
  for (let index = 0; index < options.pointCount; index += 1) {
    const angle = getMotionRandom(index, SWARM_RANDOM_ANGLE) * TAU;
    // Square-rooted so the draw spreads evenly over the disc rather than
    // crowding its middle.
    const radius =
      Math.sqrt(getMotionRandom(index, SWARM_RANDOM_RADIUS)) *
      options.cloudRadiusMeters;
    const height =
      (getMotionRandom(index, SWARM_RANDOM_HEIGHT) * 2 - 1) *
      options.cloudHeightMeters;

    const hertz =
      MIN_BUZZ_HERTZ +
      getMotionRandom(index, SWARM_RANDOM_FREQUENCY) * BUZZ_HERTZ_RANGE;
    const phase = getMotionRandom(index, SWARM_RANDOM_PHASE) * TAU;
    const amplitude =
      MIN_BUZZ_METERS +
      getMotionRandom(index, SWARM_RANDOM_AMPLITUDE) * BUZZ_METERS_RANGE;
    // Three incommensurate rates, so no two axes repeat together and the
    // point wanders instead of tracing a closed figure.
    const buzz = crossingSeconds * hertz + phase;

    const offset = index * COMPONENTS_PER_VALUE;
    worldPositions[offset] =
      centre.x + Math.cos(angle) * radius + Math.sin(buzz) * amplitude;
    worldPositions[offset + 1] =
      centre.y + height + Math.sin(buzz * 1.47 + phase) * amplitude * 0.7;
    worldPositions[offset + 2] =
      centre.z + Math.sin(angle) * radius + Math.cos(buzz * 1.83) * amplitude;
  }
}

function setSwarmVisible(state: PassageSwarmState, visible: boolean): void {
  if (state.trail) state.trail.points.visible = visible;
}

function unloadSwarm(state: PassageSwarmState, scene: Scene): void {
  const trail = state.trail;
  if (!trail) return;

  state.trail = undefined;
  scene.remove(trail.points);
  trail.dispose();
}
