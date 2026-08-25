/*
 * Purpose: Derive a terrain color from each vertex elevation.
 * Context: Design levels author low and high colors without adding CPU color buffers.
 * Responsibility: Interpolate the authored colors across the configured elevation range.
 * Boundary: Terrain geometry, world-surface sampling, and material lifecycle stay in TypeScript.
 */

uniform vec3 terrainLowElevationColor;
uniform vec3 terrainHighElevationColor;
uniform float terrainMinimumElevation;
uniform float terrainMaximumElevation;

attribute vec4 zoneConditions;
varying vec3 terrainElevationColor;
varying vec4 interpolatedZoneConditions;

void passTerrainElevationColor(vec3 transformedPosition) {
  float progress = smoothstep(
    terrainMinimumElevation,
    terrainMaximumElevation,
    transformedPosition.y
  );
  terrainElevationColor = mix(
    terrainLowElevationColor,
    terrainHighElevationColor,
    progress
  );
  interpolatedZoneConditions = zoneConditions;
}
