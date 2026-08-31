/**
 * Purpose: Decide where each fly swarm sits and what ground it sits above.
 * Context: Swarms occupy player-centred rings and must clear terrain that slopes under them.
 * Responsibility: Own ring placement, water rejection, and the fitted ground plane per anchor.
 * Boundary: Boid stepping, swarm volumes, and rendering stay in the files beside this one.
 */

import type { WorldSurface } from "../../world-surface/world-surface";
import { getMotionRandom } from "./motion-random";
import { MOTION_SENSE_SETTINGS } from "./motion-sense-settings";

const TAU = Math.PI * 2;

/** Fixed random channel indexes; the fly streams live in `fly-swarms.ts`. */
const ANCHOR_RANDOM_ANGLE = 8;
const ANCHOR_RANDOM_RADIUS = 9;

/** The world placement of one swarm and the ground plane fitted under it. */
export interface SwarmAnchor {
  x: number;
  y: number;
  z: number;

  /**
   * Ground slope under the anchor, in metres of rise per metre travelled.
   * Flies are held above this plane rather than above the anchor's own
   * height, so a stray metres out over a hillside rides the slope instead of
   * passing through it — for five height-field samples per swarm per frame
   * rather than one per fly.
   */
  groundSlopeX: number;
  groundSlopeZ: number;
}

/** The terrain queries anchor placement needs, and nothing more. */
export interface AnchorSurface {
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
}

/** Allocate one unplaced anchor per swarm; `placeSwarmAnchors` settles them. */
export function createSwarmAnchors(swarmCount: number): SwarmAnchor[] {
  return Array.from({ length: swarmCount }, () => ({
    x: 0,
    y: 0,
    z: 0,
    groundSlopeX: 0,
    groundSlopeZ: 0,
  }));
}

/**
 * Place every swarm anchor on its player-centred ring. A bounded candidate
 * search rejects water; when every candidate misses, the last one still
 * anchors the swarm so coverage never silently drops.
 */
export function placeSwarmAnchors(
  anchors: readonly SwarmAnchor[],
  surface: AnchorSurface,
  epoch: number,
  playerX: number,
  playerZ: number,
): void {
  for (let swarmIndex = 0; swarmIndex < anchors.length; swarmIndex += 1) {
    const anchor = anchors[swarmIndex];
    if (!anchor) continue;

    const ring = getSwarmRing(swarmIndex, anchors.length);
    for (
      let attempt = 0;
      attempt < MOTION_SENSE_SETTINGS.placementAttemptsPerAnchor;
      attempt += 1
    ) {
      const angle =
        getMotionRandom(swarmIndex, ANCHOR_RANDOM_ANGLE, epoch, attempt) * TAU;
      const radius =
        ring.minMeters +
        Math.sqrt(
          getMotionRandom(swarmIndex, ANCHOR_RANDOM_RADIUS, epoch, attempt),
        ) *
          (ring.maxMeters - ring.minMeters);
      anchor.x = playerX + Math.cos(angle) * radius;
      anchor.z = playerZ + Math.sin(angle) * radius;
      if (surface.zoneAt(anchor.x, anchor.z) !== "water") break;
    }
    // A fresh anchor snaps onto its ground plane; only later frames ease.
    sampleGroundPlane(surface.groundYAt, anchor.x, anchor.z);
    anchor.y =
      scratchGroundPlane.height + MOTION_SENSE_SETTINGS.groundClearanceMeters;
    anchor.groundSlopeX = scratchGroundPlane.slopeX;
    anchor.groundSlopeZ = scratchGroundPlane.slopeZ;
  }
}

/**
 * Ease one settled anchor toward the ground beneath it. Height and slope
 * settle together, so the floor a stray rides never disagrees with the height
 * its own swarm centre is easing toward.
 */
export function settleAnchorGround(
  anchor: SwarmAnchor,
  groundYAt: WorldSurface["groundYAt"],
): void {
  sampleGroundPlane(groundYAt, anchor.x, anchor.z);
  const followRate = MOTION_SENSE_SETTINGS.anchorGroundFollowRate;
  const groundedY =
    scratchGroundPlane.height + MOTION_SENSE_SETTINGS.groundClearanceMeters;
  anchor.y += (groundedY - anchor.y) * followRate;
  anchor.groundSlopeX +=
    (scratchGroundPlane.slopeX - anchor.groundSlopeX) * followRate;
  anchor.groundSlopeZ +=
    (scratchGroundPlane.slopeZ - anchor.groundSlopeZ) * followRate;
}

/** The ground height and slope under one anchor, reused every frame. */
const scratchGroundPlane = { height: 0, slopeX: 0, slopeZ: 0 };

/**
 * Fit the terrain under one swarm with a plane. A central difference costs
 * five height-field samples, which is what buys every fly in the swarm a
 * sloped floor instead of the flat one its anchor height alone would give.
 */
function sampleGroundPlane(
  groundYAt: WorldSurface["groundYAt"],
  anchorX: number,
  anchorZ: number,
): void {
  const step = MOTION_SENSE_SETTINGS.groundSlopeSampleMeters;
  scratchGroundPlane.height = groundYAt(anchorX, anchorZ);
  scratchGroundPlane.slopeX =
    (groundYAt(anchorX + step, anchorZ) - groundYAt(anchorX - step, anchorZ)) /
    (2 * step);
  scratchGroundPlane.slopeZ =
    (groundYAt(anchorX, anchorZ + step) - groundYAt(anchorX, anchorZ - step)) /
    (2 * step);
}

/** The distance ring for one swarm, interpolated near to far across the pool. */
function getSwarmRing(
  swarmIndex: number,
  swarmCount: number,
): { readonly minMeters: number; readonly maxMeters: number } {
  const { nearRing, farRing } = MOTION_SENSE_SETTINGS;
  const mix = swarmCount <= 1 ? 0 : swarmIndex / (swarmCount - 1);
  return {
    minMeters:
      nearRing.minMeters + (farRing.minMeters - nearRing.minMeters) * mix,
    maxMeters:
      nearRing.maxMeters + (farRing.maxMeters - nearRing.maxMeters) * mix,
  };
}
