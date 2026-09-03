/**
 * Purpose: Print the trail of one flown passage crossing the visitor's flight.
 * Context: The flocks leave a trace; an animal that crosses the same sky must too.
 * Responsibility: Own the ring, and print into it while the animal is crossing.
 * Boundary: Where the animal is comes from the passage; how it flies is its own.
 */

import type { Scene } from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { MotionSenseParameters } from "./motion-sense-settings";
import {
  createMotionTrailBuffer,
  type MotionTrailBuffer,
} from "./motion-trail-buffer";

/** Body and both wingtips, the three points every bird here prints. */
const PASSAGE_TRACE_POINTS = 3;

/**
 * Write the animal's three world points and answer whether it is crossing at
 * all. False leaves the points untouched, so a ring keeps ageing what it holds
 * rather than printing the way to wherever the animal will next appear.
 */
export type ReadFlownTrace = (out: Float32Array) => boolean;

export interface PassageTraceOptions {
  readonly scene: Scene;
  readonly parameters: MotionSenseParameters;
  /** Ring depth in rendered frames; a crossing draws a line, not a cloud. */
  readonly trailLifetimeFrames: number;
  readonly readTrace: ReadFlownTrace;
}

interface PassageTraceState {
  trail: MotionTrailBuffer | undefined;
  readonly worldPositions: Float32Array;
  crossing: boolean;
}

/**
 * Its own module rather than a part of Motion Sense, for the same reason the
 * swarm passage is: a passage crosses the show on the schedule's terms, not on
 * the strength of a sense. It prints at full intensity and carries no sense
 * fade, so the trace is there whenever the animal is.
 */
export function createPassageTraceModule(
  options: PassageTraceOptions,
): WorldModule {
  const state: PassageTraceState = {
    trail: undefined,
    worldPositions: new Float32Array(PASSAGE_TRACE_POINTS * 3),
    crossing: false,
  };

  return {
    load: () => loadTrace(state, options),
    activate: () => setTraceVisible(state, true),
    update: () => updateTrace(state, options),
    deactivate: () => setTraceVisible(state, false),
    unload: () => unloadTrace(state, options.scene),
  };
}

function loadTrace(
  state: PassageTraceState,
  options: PassageTraceOptions,
): void {
  const { parameters } = options;
  const trail = createMotionTrailBuffer({
    pointCount: PASSAGE_TRACE_POINTS,
    trail: {
      ...parameters.trail,
      lifetimeFrames: options.trailLifetimeFrames,
    },
    // The bird's own trace colour, not the flocks': it crosses the sky the
    // flocks are already printing, and reading as one of them would lose it.
    appearance: parameters.birds?.appearance ?? parameters.appearance,
    intensity: parameters.intensity,
  });
  trail.points.visible = false;
  options.scene.add(trail.points);
  state.trail = trail;
}

function updateTrace(
  state: PassageTraceState,
  options: PassageTraceOptions,
): void {
  const trail = state.trail;
  if (!trail) return;

  if (options.readTrace(state.worldPositions)) {
    if (!state.crossing) {
      // Arriving somewhere else entirely; the ring must not draw the way here.
      trail.forgetHistory();
      state.crossing = true;
    }
  } else {
    // Away: the points are left where they were, so the ring ages out what it
    // already holds and prints nothing new over it.
    state.crossing = false;
  }
  trail.spawnFromWorldPoints(state.worldPositions);
}

function setTraceVisible(state: PassageTraceState, visible: boolean): void {
  if (state.trail) state.trail.points.visible = visible;
}

function unloadTrace(state: PassageTraceState, scene: Scene): void {
  const trail = state.trail;
  if (!trail) return;

  state.trail = undefined;
  scene.remove(trail.points);
  trail.dispose();
}
