/**
 * Purpose: Verify deterministic physical facts exposed by WorldSurface.
 * Context: Render modules need stable heights and zone identities at absolute coordinates.
 * Responsibility: Cover repeatability, river geometry, zones, and authored relief.
 * Boundary: Chunk recycling, materials, and physical PCVR timing are tested elsewhere.
 */

import { describe, expect, test } from "bun:test";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import {
  getZoneId,
  type ZoneConditions,
} from "../../src/world-surface/zone-field";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const worldSurface = createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);

describe("WorldSurface", () => {
  test("returns the same facts for the same world position", () => {
    const worldX = 64;
    const worldZ = -32;

    expect(worldSurface.groundYAt(worldX, worldZ)).toBe(
      worldSurface.groundYAt(worldX, worldZ),
    );
    expect(worldSurface.surfaceYAt(worldX, worldZ)).toBe(
      worldSurface.surfaceYAt(worldX, worldZ),
    );
    expect(worldSurface.zoneAt(worldX, worldZ)).toBe(
      worldSurface.zoneAt(worldX, worldZ),
    );
    expect(worldSurface.zoneConditionsAt(worldX, worldZ)).toEqual(
      worldSurface.zoneConditionsAt(worldX, worldZ),
    );
  });

  test("derives every hard zone from continuous conditions", () => {
    expect(classify({ riverChannelMarginMeters: 1, waterDepthMeters: 1 })).toBe(
      "water",
    );
    expect(classify({ groundSlope: 1 })).toBe("shrubSlope");
    expect(classify({ forestRegionValue: -1 })).toBe("coniferForest");
    expect(classify({ forestRegionValue: 1 })).toBe("deciduousForest");
    expect(classify({})).toBe("meadow");
  });

  test("carves solid ground below the river surface", () => {
    const groundY = worldSurface.groundYAt(0, 0);
    const surfaceY = worldSurface.surfaceYAt(0, 0);

    expect(worldSurface.zoneAt(0, 0)).toBe("water");
    expect(groundY).toBe(WORLD_SURFACE_SETTINGS.river.riverBedHeightY);
    expect(surfaceY).toBe(WORLD_SURFACE_SETTINGS.river.waterHeightY);
    expect(surfaceY).toBeGreaterThan(groundY);
  });

  test("uses ground as the visible surface outside water", () => {
    const worldX = 0;
    const worldZ = 20;

    expect(worldSurface.zoneAt(worldX, worldZ)).not.toBe("water");
    expect(worldSurface.surfaceYAt(worldX, worldZ)).toBe(
      worldSurface.groundYAt(worldX, worldZ),
    );
  });

  test("contains high ground and deep valleys across the flight world", () => {
    const worldRelief = measureGroundRelief({
      minX: -1_024,
      maxX: 1_024,
      minZ: -1_024,
      maxZ: 1_024,
      step: 16,
    });

    expect(worldRelief.highestY).toBeGreaterThan(2);
    expect(worldRelief.lowestY).toBeLessThan(-10);
    expect(worldRelief.heightRange).toBeGreaterThan(16);
  });

  test("combines calm lowlands with more undulating hill regions", () => {
    const calmLowlands = measureGroundRelief(around(-576, -192, 48));
    const rollingHills = measureGroundRelief(around(-192, -192, 48));

    expect(calmLowlands.heightRange).toBeLessThan(7);
    expect(rollingHills.heightRange).toBeGreaterThan(10);
  });

  test("starts the flight inside a valley facing nearby high ground", () => {
    const initialView = measureGroundRelief({
      minX: -80,
      maxX: 80,
      minZ: -128,
      maxZ: 0,
      step: 8,
    });

    expect(initialView.lowestY).toBeLessThanOrEqual(-9.5);
    expect(initialView.highestY).toBeGreaterThan(0);
    expect(initialView.heightRange).toBeGreaterThan(8);
  });

  test("keeps hill ridges smooth at the terrain mesh spacing", () => {
    const terrainVertexSpacing = 64 / 32;
    // Sampled clear of the river: the carved gorge wall is authored steeper
    // than the mesh spacing, so only open hill ground is covered here.
    const largestHeightStep = measureLargestHorizontalHeightStep({
      minX: 160,
      maxX: 240,
      minZ: -128,
      maxZ: 0,
      step: terrainVertexSpacing,
    });

    expect(largestHeightStep).toBeLessThan(1);
  });
});

function classify(overrides: Partial<ZoneConditions>) {
  const conditions: ZoneConditions = {
    riverChannelMarginMeters: -1,
    waterDepthMeters: -1,
    groundSlope: 0,
    forestRegionValue: 0,
    ...overrides,
  };

  return getZoneId(conditions, ZONE_SETTINGS);
}

interface SampleArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly step: number;
}

interface GroundRelief {
  readonly lowestY: number;
  readonly highestY: number;
  readonly heightRange: number;
}

function around(centerX: number, centerZ: number, radius: number): SampleArea {
  return {
    minX: centerX - radius,
    maxX: centerX + radius,
    minZ: centerZ - radius,
    maxZ: centerZ + radius,
    step: radius,
  };
}

function measureGroundRelief(area: SampleArea): GroundRelief {
  const columnCount = Math.floor((area.maxX - area.minX) / area.step) + 1;
  const rowCount = Math.floor((area.maxZ - area.minZ) / area.step) + 1;
  const heights = Array.from({ length: columnCount * rowCount }, (_, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    return worldSurface.groundYAt(
      area.minX + column * area.step,
      area.minZ + row * area.step,
    );
  });
  const lowestY = Math.min(...heights);
  const highestY = Math.max(...heights);

  return { lowestY, highestY, heightRange: highestY - lowestY };
}

function measureLargestHorizontalHeightStep(area: SampleArea): number {
  let largestHeightStep = 0;

  for (let worldZ = area.minZ; worldZ <= area.maxZ; worldZ += area.step) {
    largestHeightStep = Math.max(
      largestHeightStep,
      measureLargestRowStep(area, worldZ),
    );
  }

  return largestHeightStep;
}

function measureLargestRowStep(area: SampleArea, worldZ: number): number {
  let previousHeight = worldSurface.groundYAt(area.minX, worldZ);
  let largestHeightStep = 0;

  for (
    let worldX = area.minX + area.step;
    worldX <= area.maxX;
    worldX += area.step
  ) {
    const height = worldSurface.groundYAt(worldX, worldZ);
    largestHeightStep = Math.max(
      largestHeightStep,
      Math.abs(height - previousHeight),
    );
    previousHeight = height;
  }

  return largestHeightStep;
}
