/*
 * Purpose: Add the heat warm bodies leave on the ground they stand on.
 * Context: Only Terrain receives external heat sources; every other surface skips this cost.
 * Responsibility: Pool the published sources with a short, smooth, noise-broken falloff.
 * Boundary: Where the sources come from stays with the composition root; the ramp stays in the fragment stage.
 *
 * This runs per fragment. The previous vertex-stage version could not: terrain
 * vertices sit two metres apart, so a pool this small resolved into three or
 * four samples and read as a flat faceted disc — the "large warm radius around
 * the animal" this file exists to replace.
 *
 * Only the terrain variant compiles this header, and it is the only variant
 * that defines THERMAL_GROUND_HEAT, so grass, props, and animals never pay for
 * the loop.
 */

/*
 * One pool per visible actor: xyz is the world position, w the pool strength,
 * and an unused slot carries strength zero so it contributes nothing without a
 * branch. The array size is fixed at compile time and mirrors
 * THERMAL_GROUND_HEAT_SOURCE_COUNT; the loop below is constant-bounded, so it
 * unrolls rather than becoming dynamic flow control.
 */
const int THERMAL_HEAT_SOURCE_COUNT = 4;

uniform vec4 thermalHeatSources[THERMAL_HEAT_SOURCE_COUNT];
uniform float thermalGroundHeatRadiusMeters;
uniform float thermalGroundHeatEdgeBreakup;

/*
 * A compact cubic kernel: one at the source, exactly zero at the radius, and
 * smooth at both ends. It needs no square root and no smoothstep, which is
 * what makes four of them per fragment affordable.
 *
 * `breakup` displaces the squared radius by the ground's own detail field, so
 * the pool edge wanders with the texture underneath it and never draws the
 * circle a constant radius would.
 */
float thermalGroundHeat(vec2 worldXZ, float breakup) {
  float inverseRadiusSquared =
    1.0 / (thermalGroundHeatRadiusMeters * thermalGroundHeatRadiusMeters);
  float pooled = 0.0;
  for (int index = 0; index < THERMAL_HEAT_SOURCE_COUNT; index += 1) {
    vec4 source = thermalHeatSources[index];
    vec2 offset = worldXZ - source.xz;
    float reach = clamp(
      1.0 - dot(offset, offset) * inverseRadiusSquared +
        breakup * thermalGroundHeatEdgeBreakup,
      0.0,
      1.0
    );
    // Cubed rather than squared: the pool concentrates under the body and
    // leaves a long, thin tail, so the ground reads as bled heat with no
    // recognisable boundary at all.
    pooled = max(pooled, source.w * reach * reach * reach);
  }
  return pooled;
}
