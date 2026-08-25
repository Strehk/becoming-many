/**
 * Purpose: Describe and classify the continuous conditions behind every world zone.
 * Context: Geometry, textures, and assets need the same zone facts without inheriting a chunk grid.
 * Responsibility: Sample absolute world coordinates and derive one hard ZoneId when requested.
 * Boundary: Authored thresholds live in zone-settings; colors and GPU resources live in modules.
 */

import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { getGroundY, getRiverDistance } from "./height-field";
import type { WorldSurfaceSettings } from "./surface-settings";
import type { ZoneId, ZoneSettings } from "./zone-settings";

const zoneNoise = new ImprovedNoise();
const SLOPE_SAMPLE_DISTANCE_METERS = 1;

/**
 * Continuous facts used to classify zones.
 *
 * Terrain can interpolate these values across a triangle before classification,
 * while content modules can classify an exact absolute world position on the CPU.
 */
export interface ZoneConditions {
  readonly riverChannelMarginMeters: number;
  readonly waterDepthMeters: number;
  readonly groundSlope: number;
  readonly forestRegionValue: number;
}

export interface ZoneFieldSettings {
  readonly surface: WorldSurfaceSettings;
  readonly zones: ZoneSettings;
}

export function getZoneConditions(
  worldX: number,
  worldZ: number,
  settings: ZoneFieldSettings,
): ZoneConditions {
  const { surface, zones } = settings;
  const groundY = getGroundY(worldX, worldZ, surface);
  const riverDistance = getRiverDistance(worldX, worldZ, surface);

  return {
    riverChannelMarginMeters:
      surface.river.channelHalfWidthMeters - riverDistance,
    waterDepthMeters: surface.river.waterHeightY - groundY,
    groundSlope: getGroundSlope(worldX, worldZ, surface),
    forestRegionValue: zoneNoise.noise(
      worldX / zones.featureSizeMeters,
      worldZ / zones.featureSizeMeters,
      surface.seed / 1_000 + 41,
    ),
  };
}

/** Apply the one shared hard-zone priority to already sampled conditions. */
export function getZoneId(
  conditions: ZoneConditions,
  settings: ZoneSettings,
): ZoneId {
  if (isWater(conditions)) return "water";
  if (conditions.groundSlope >= settings.shrubSlopeThreshold) {
    return "shrubSlope";
  }
  if (conditions.forestRegionValue <= settings.coniferForestThreshold) {
    return "coniferForest";
  }
  if (conditions.forestRegionValue >= settings.deciduousForestThreshold) {
    return "deciduousForest";
  }
  return "meadow";
}

function isWater(conditions: ZoneConditions): boolean {
  return (
    conditions.riverChannelMarginMeters >= 0 && conditions.waterDepthMeters > 0
  );
}

function getGroundSlope(
  worldX: number,
  worldZ: number,
  settings: WorldSurfaceSettings,
): number {
  const distance = SLOPE_SAMPLE_DISTANCE_METERS;
  const heightChangeX =
    (getGroundY(worldX + distance, worldZ, settings) -
      getGroundY(worldX - distance, worldZ, settings)) /
    (distance * 2);
  const heightChangeZ =
    (getGroundY(worldX, worldZ + distance, settings) -
      getGroundY(worldX, worldZ - distance, settings)) /
    (distance * 2);

  return Math.hypot(heightChangeX, heightChangeZ);
}
