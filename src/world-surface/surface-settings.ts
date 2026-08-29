/**
 * Purpose: Define the physical shape of the deterministic world surface.
 * Context: Terrain and rivers share one authored coordinate space and seed.
 * Responsibility: Keep ground and river values in one editable place.
 * Boundary: Zone classification lives in zone-settings; rendering lives in modules.
 */

export const WORLD_SURFACE_SETTINGS = {
  seed: 174, // Changes the deterministic shape of terrain, river, and zones.
  heightField: {
    baseHeightY: -8, // Sets the starting world height before elevation is added.
    rollingElevationMeters: 5, // Sets the maximum height of broad hills and valleys.
    rollingFeatureSizeMeters: 300, // Larger values create wider, smoother hills.
    detailElevationMeters: 0.8, // Sets the maximum height of small surface variation.
    detailFeatureSizeMeters: 44, // Larger values spread surface details farther apart.
    mountainElevationMeters: 9, // Sets the maximum height added by mountain ridges.
    mountainFeatureSizeMeters: 240, // Larger values create broader mountain ridges.
    mountainRegionSizeMeters: 520, // Larger values create larger mountain regions.
  },
  river: {
    waterHeightY: -7, // Sets the fixed world height of the water surface.
    riverBedHeightY: -9.5, // Sets the ground height at the center of the river.
    channelHalfWidthMeters: 2.5, // Sets the water channel width from center to one side.
    bankHalfWidthMeters: 28, // Sets where carved banks return to natural terrain.
    primaryMeanderAmplitudeMeters: 10, // Sets the sideways reach of broad river bends.
    primaryMeanderLengthMeters: 90, // Larger values make broad bends change more slowly.
    secondaryMeanderAmplitudeMeters: 3, // Adds smaller sideways bends to the river.
    secondaryMeanderLengthMeters: 34, // Larger values make small bends change more slowly.
  },
};

export type WorldSurfaceSettings = typeof WORLD_SURFACE_SETTINGS;
