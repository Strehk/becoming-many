/*
 * Purpose: Pass continuous zone conditions from Terrain to each rendered pixel.
 * Context: Hard zone boundaries should cross triangles instead of following vertex colors.
 * Responsibility: Forward one compact vec4 without changing terrain positions.
 * Boundary: World Surface calculates values; the fragment shader classifies them.
 */

attribute vec4 zoneConditions;
varying vec4 interpolatedZoneConditions;

void passZoneConditionsToFragment() {
  interpolatedZoneConditions = zoneConditions;
}
