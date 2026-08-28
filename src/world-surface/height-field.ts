/**
 * Purpose: Calculate deterministic ground and visible-surface heights.
 * Context: Every consumer must observe the same terrain and river at world coordinates.
 * Responsibility: Combine continuous noise with one analytical carved river.
 * Boundary: Zone assignment, rendering, chunks, and lifecycle stay elsewhere.
 */

import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import type { WorldSurfaceSettings } from "./surface-settings";

const terrainNoise = new ImprovedNoise();

export function getGroundY(
  worldX: number,
  worldZ: number,
  settings: WorldSurfaceSettings,
): number {
  const naturalGroundY = getNaturalGroundY(worldX, worldZ, settings);
  const riverDistance = getRiverDistance(worldX, worldZ, settings);
  const bankProgress = smoothstep(
    settings.river.channelHalfWidthMeters,
    settings.river.bankHalfWidthMeters,
    riverDistance,
  );
  const carvedGroundY = mix(
    settings.river.riverBedHeightY,
    naturalGroundY,
    bankProgress,
  );

  return Math.min(naturalGroundY, carvedGroundY);
}

export function getSurfaceY(
  worldX: number,
  worldZ: number,
  settings: WorldSurfaceSettings,
): number {
  const { groundY, hasWater } = getWaterState(worldX, worldZ, settings);
  return hasWater ? settings.river.waterHeightY : groundY;
}

function getWaterState(
  worldX: number,
  worldZ: number,
  settings: WorldSurfaceSettings,
): { readonly groundY: number; readonly hasWater: boolean } {
  const groundY = getGroundY(worldX, worldZ, settings);
  const riverDistance = getRiverDistance(worldX, worldZ, settings);
  const hasWater =
    riverDistance <= settings.river.channelHalfWidthMeters &&
    groundY < settings.river.waterHeightY;

  return { groundY, hasWater };
}

function getNaturalGroundY(
  worldX: number,
  worldZ: number,
  settings: WorldSurfaceSettings,
): number {
  const { heightField, seed } = settings;
  const noiseLayer = seed / 1_000;
  const rollingHeight =
    terrainNoise.noise(
      worldX / heightField.rollingFeatureSizeMeters,
      worldZ / heightField.rollingFeatureSizeMeters,
      noiseLayer,
    ) * heightField.rollingElevationMeters;
  const detailHeight =
    terrainNoise.noise(
      worldX / heightField.detailFeatureSizeMeters,
      worldZ / heightField.detailFeatureSizeMeters,
      noiseLayer + 17,
    ) * heightField.detailElevationMeters;
  const mountainRegion = smoothstep(
    0,
    0.55,
    terrainNoise.noise(
      worldX / heightField.mountainRegionSizeMeters,
      worldZ / heightField.mountainRegionSizeMeters,
      noiseLayer + 31,
    ),
  );
  const ridgeNoise = terrainNoise.noise(
    worldX / heightField.mountainFeatureSizeMeters,
    worldZ / heightField.mountainFeatureSizeMeters,
    noiseLayer + 53,
  );
  const mountainHeight =
    mountainRegion *
    (1 - ridgeNoise * ridgeNoise) ** 3 *
    heightField.mountainElevationMeters;

  return (
    heightField.baseHeightY + rollingHeight + detailHeight + mountainHeight
  );
}

/** Bound every reachable ground height so consumers can normalize elevation. */
export function getElevationRange(settings: WorldSurfaceSettings): {
  readonly minimumElevation: number;
  readonly maximumElevation: number;
} {
  const { heightField, river } = settings;
  const minimumNaturalElevation =
    heightField.baseHeightY -
    heightField.rollingElevationMeters -
    heightField.detailElevationMeters;
  const maximumElevation =
    heightField.baseHeightY +
    heightField.rollingElevationMeters +
    heightField.detailElevationMeters +
    heightField.mountainElevationMeters;

  return {
    minimumElevation: Math.min(minimumNaturalElevation, river.riverBedHeightY),
    maximumElevation,
  };
}

export function getRiverDistance(
  worldX: number,
  worldZ: number,
  settings: WorldSurfaceSettings,
): number {
  const { river, seed } = settings;
  const phase = ((seed % 360) * Math.PI) / 180;
  const riverCenterX =
    Math.sin(worldZ / river.primaryMeanderLengthMeters + phase) *
      river.primaryMeanderAmplitudeMeters +
    Math.sin(worldZ / river.secondaryMeanderLengthMeters - phase) *
      river.secondaryMeanderAmplitudeMeters;

  return Math.abs(worldX - riverCenterX);
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number): number {
  const progress = Math.min(
    Math.max((value - edgeStart) / (edgeEnd - edgeStart), 0),
    1,
  );
  return progress * progress * (3 - 2 * progress);
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
