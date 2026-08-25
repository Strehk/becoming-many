/**
 * Purpose: Expose the render-free world-surface contract.
 * Context: Terrain and future content modules need deterministic facts at world coordinates.
 * Responsibility: Bind authored settings to separate height and zone queries.
 * Boundary: Chunks, lifecycle, Three.js resources, materials, and colors stay elsewhere.
 */

import { getGroundY, getSurfaceY } from "./height-field";
import type { WorldSurfaceSettings } from "./surface-settings";
import {
  getZoneConditions,
  getZoneId,
  type ZoneConditions,
} from "./zone-field";
import type { ZoneId, ZoneSettings } from "./zone-settings";

export interface WorldSurface {
  readonly groundYAt: (worldX: number, worldZ: number) => number;
  readonly surfaceYAt: (worldX: number, worldZ: number) => number;
  readonly zoneConditionsAt: (worldX: number, worldZ: number) => ZoneConditions;
  readonly zoneAt: (worldX: number, worldZ: number) => ZoneId;
}

export function createWorldSurface(
  surfaceSettings: WorldSurfaceSettings,
  zoneSettings: ZoneSettings,
): WorldSurface {
  const zoneFieldSettings = {
    surface: surfaceSettings,
    zones: zoneSettings,
  };
  const zoneConditionsAt = (worldX: number, worldZ: number) =>
    getZoneConditions(worldX, worldZ, zoneFieldSettings);

  return {
    groundYAt: (worldX, worldZ) => getGroundY(worldX, worldZ, surfaceSettings),
    surfaceYAt: (worldX, worldZ) =>
      getSurfaceY(worldX, worldZ, surfaceSettings),
    zoneConditionsAt,
    zoneAt: (worldX, worldZ) =>
      getZoneId(zoneConditionsAt(worldX, worldZ), zoneSettings),
  };
}
