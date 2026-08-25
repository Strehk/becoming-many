/*
 * Purpose: Apply the elevation color calculated by the Terrain vertex shader.
 * Context: The gradient stays inside Terrain's existing opaque material pass.
 * Responsibility: Replace the neutral base color without textures or extra geometry.
 * Boundary: Elevation mapping and authored values stay outside this shader.
 */

varying vec3 terrainElevationColor;
varying vec4 interpolatedZoneConditions;

uniform vec3 terrainWaterColor;

vec3 getTerrainColor() {
  float riverChannelMarginMeters = interpolatedZoneConditions.x;
  float waterDepthMeters = interpolatedZoneConditions.y;
  bool hasWater = riverChannelMarginMeters >= 0.0 && waterDepthMeters > 0.0;
  return hasWater ? terrainWaterColor : terrainElevationColor;
}
