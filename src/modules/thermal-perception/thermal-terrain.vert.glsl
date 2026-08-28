/*
 * Purpose: Carry the CPU-sampled ground warmth and the sampling frame into the fragment stage.
 * Context: Terrain streams a per-vertex warmth attribute from elevation, exposure, and mottling.
 * Responsibility: Write the radial view distance and publish world position for the fine detail.
 * Boundary: Warmth sampling stays on the CPU; detail, hotspots, and heat pools stay in the fragment stage.
 *
 * Terrain vertices sit two metres apart, which fixes what this stage can carry:
 * the attribute holds the tens-of-metres mottling and nothing below roughly
 * eight metres, because anything finer aliases against the grid instead of
 * reading as texture. Everything smaller — and the heat pools under warm
 * bodies, which are smaller than two vertices across — is measured per
 * fragment from the world position published here.
 */

attribute float thermalWarmth;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying vec3 thermalDetailPosition;
varying float thermalWarmWeight;

/*
 * Terrain deletes its normal attribute (an unlit heightfield never needed
 * one), so it cannot take part in the hemispheric shade and passes the neutral
 * value. Its form comes from elevation, exposure, and mottling instead.
 */
varying float thermalSurfaceShade;

void passThermalPerception(vec4 viewPosition) {
  thermalViewDistance = length(viewPosition.xyz);
  thermalDetailPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  interpolatedThermalWarmth = thermalWarmth;
  // Ground is all surface and no interior, so nothing here damps the hotspots
  // the way a body's cool extremities do.
  thermalWarmWeight = 1.0;
  thermalSurfaceShade = 1.0;
}
