/**
 * Purpose: Hold one raptor on a ring over a place in the landscape.
 * Context: A soaring bird circles a thermal, not the visitor who happens to pass.
 * Responsibility: Own the ring, the place it stands over, and the points it prints.
 * Boundary: The body flying it and the trail ring it prints into live beside this.
 */

import type { WorldSurface } from "../../world-surface/world-surface";
import { getMotionRandom } from "./motion-random";
import { RAPTOR_DEFINITION } from "./raptor-definition";

const COMPONENTS_PER_VALUE = 3;
const TAU = Math.PI * 2;
const RANDOM_ANGLE = 0;
const RANDOM_REACH = 1;
/** Where the bird is, the bearing it holds, and where its wings stand. */
const BODY_VALUES = 5;
/** Below this much travel in one update there is no way to read a bearing. */
const MINIMUM_TRAVEL_SQUARED = 1e-8;

export interface RaptorFlightOptions {
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly initialPlayerX: number;
  readonly initialPlayerZ: number;
}

export interface RaptorFlight {
  /** Body and both wingtips, the same three points a flock bird prints. */
  readonly getWorldPositions: () => Float32Array;
  /** Where the bird is, the bearing it holds, and where its wings stand. */
  readonly getBodyStream: () => Float32Array;
  readonly update: (
    deltaSeconds: number,
    playerX: number,
    playerZ: number,
  ) => void;
}

/** The points one raptor prints: body plus two wingtips. */
export const RAPTOR_POINT_COUNT = 3;

/**
 * The bird circles a place, not a person. Its ring stands over a fixed point
 * of the landscape and stays there while a visitor flies past and away; only
 * when the ring has been left far enough behind to be out of the world does
 * another one open ahead, which is the one thing a wandering visitor makes
 * necessary.
 */
export function createRaptorFlight(options: RaptorFlightOptions): RaptorFlight {
  const worldPositions = new Float32Array(
    RAPTOR_POINT_COUNT * COMPONENTS_PER_VALUE,
  );
  const bodyStream = new Float32Array(BODY_VALUES);
  const centre = { x: options.initialPlayerX, z: options.initialPlayerZ };
  const previousPlayer = {
    x: options.initialPlayerX,
    z: options.initialPlayerZ,
  };
  let ringAngleRadians = 0;
  let elapsedSeconds = 0;
  let ringEpoch = 0;
  // The way the traveller last went, which is where the next ring opens.
  let travelBearing = 0;

  const openRingAhead = (
    playerX: number,
    playerZ: number,
    travelBearing: number,
  ): void => {
    ringEpoch += 1;
    // Ahead, off to one side: a ring opened in any direction is behind a
    // traveller within the minute, and a bird nobody ever flies toward is a
    // bird nobody meets. The spread keeps it from sitting on the nose.
    const spread =
      (getMotionRandom(ringEpoch, RANDOM_ANGLE) - 0.5) *
      RAPTOR_DEFINITION.reopenSpreadRadians;
    const angle = travelBearing + spread;
    const reach =
      RAPTOR_DEFINITION.reopenReachMeters.minimum +
      getMotionRandom(ringEpoch, RANDOM_REACH) *
        (RAPTOR_DEFINITION.reopenReachMeters.maximum -
          RAPTOR_DEFINITION.reopenReachMeters.minimum);
    centre.x = playerX + Math.sin(angle) * reach;
    centre.z = playerZ + Math.cos(angle) * reach;
  };

  const writePoints = (): void => {
    const radius = RAPTOR_DEFINITION.ringRadiusMeters;
    const worldX = centre.x + Math.cos(ringAngleRadians) * radius;
    const worldZ = centre.z + Math.sin(ringAngleRadians) * radius;
    // The ring rises and falls over its turn: a soaring bird gains height on
    // one side of the circle and gives it back on the other.
    const worldY =
      options.groundYAt(worldX, worldZ) +
      RAPTOR_DEFINITION.heightAboveGroundMeters +
      Math.sin(ringAngleRadians * 2) * RAPTOR_DEFINITION.ringRiseMeters;

    const headingX = -Math.sin(ringAngleRadians);
    const headingZ = Math.cos(ringAngleRadians);
    const lateralX = -headingZ;
    const lateralZ = headingX;
    const halfSpan = RAPTOR_DEFINITION.wingSpanMeters / 2;
    // The wing beat is slow and shallow, as a held wing is: the trace it
    // prints is a line drawn across the sky rather than a stitched seam.
    const beat = Math.sin(elapsedSeconds * RAPTOR_DEFINITION.beatHertz * TAU);
    const beatLift = beat * RAPTOR_DEFINITION.beatAmplitudeMeters;

    worldPositions[0] = worldX;
    worldPositions[1] = worldY;
    worldPositions[2] = worldZ;
    worldPositions[3] = worldX + lateralX * halfSpan;
    worldPositions[4] = worldY + beatLift;
    worldPositions[5] = worldZ + lateralZ * halfSpan;
    worldPositions[6] = worldX - lateralX * halfSpan;
    worldPositions[7] = worldY + beatLift;
    worldPositions[8] = worldZ - lateralZ * halfSpan;

    bodyStream[0] = worldX;
    bodyStream[1] = worldY;
    bodyStream[2] = worldZ;
    bodyStream[3] = Math.atan2(headingX, headingZ);
    bodyStream[4] = beat;
  };
  writePoints();

  return {
    getWorldPositions: () => worldPositions,
    getBodyStream: () => bodyStream,
    update: (deltaSeconds, playerX, playerZ) => {
      if (deltaSeconds <= 0) return;

      elapsedSeconds += deltaSeconds;
      ringAngleRadians +=
        (RAPTOR_DEFINITION.ringSpeedMetersPerSecond /
          RAPTOR_DEFINITION.ringRadiusMeters) *
        deltaSeconds;

      const travelX = playerX - previousPlayer.x;
      const travelZ = playerZ - previousPlayer.z;
      if (travelX * travelX + travelZ * travelZ > MINIMUM_TRAVEL_SQUARED) {
        travelBearing = Math.atan2(travelX, travelZ);
      }
      previousPlayer.x = playerX;
      previousPlayer.z = playerZ;

      const away = Math.hypot(playerX - centre.x, playerZ - centre.z);
      if (away > RAPTOR_DEFINITION.abandonRingMeters) {
        openRingAhead(playerX, playerZ, travelBearing);
      }
      writePoints();
    },
  };
}
