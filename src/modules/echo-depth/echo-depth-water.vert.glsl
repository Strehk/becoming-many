/*
 * Purpose: Carry the terrain's per-vertex water measure to the fragment stage.
 * Context: Only Terrain streams the attribute, so only its variant declares this.
 * Responsibility: Forward one signed value whose zero crossing is the shoreline.
 * Boundary: World Surface decides what water is; the fragment shader colors it.
 */

attribute float surfaceWater;

varying float echoWaterMeasure;

void passEchoWater() {
  echoWaterMeasure = surfaceWater;
}
