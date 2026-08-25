/*
 * Purpose: Convert interpolated world-zone conditions into hard diagnostic colors.
 * Context: The test view must expose zone placement without grid-shaped vertex boundaries.
 * Responsibility: Apply the same water, slope, and forest priority used by World Surface.
 * Boundary: Natural blends, textures, lighting, and authored zone values live elsewhere.
 */

varying vec4 interpolatedZoneConditions;

uniform float zoneConiferForestThreshold;
uniform float zoneDeciduousForestThreshold;
uniform float zoneShrubSlopeThreshold;
uniform vec3 zoneWaterColor;
uniform vec3 zoneMeadowColor;
uniform vec3 zoneConiferForestColor;
uniform vec3 zoneDeciduousForestColor;
uniform vec3 zoneShrubSlopeColor;

vec3 getZoneColor() {
  float riverChannelMarginMeters = interpolatedZoneConditions.x;
  float waterDepthMeters = interpolatedZoneConditions.y;
  float groundSlope = interpolatedZoneConditions.z;
  float forestRegionValue = interpolatedZoneConditions.w;

  if (riverChannelMarginMeters >= 0.0 && waterDepthMeters > 0.0) {
    return zoneWaterColor;
  }
  if (groundSlope >= zoneShrubSlopeThreshold) {
    return zoneShrubSlopeColor;
  }
  if (forestRegionValue <= zoneConiferForestThreshold) {
    return zoneConiferForestColor;
  }
  if (forestRegionValue >= zoneDeciduousForestThreshold) {
    return zoneDeciduousForestColor;
  }
  return zoneMeadowColor;
}
