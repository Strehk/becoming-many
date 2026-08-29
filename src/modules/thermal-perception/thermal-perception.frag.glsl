/*
 * Purpose: Turn a per-fragment temperature into the false-color heat image.
 * Context: Level 05 shows heat directly; the sense reaches only a bounded radius.
 * Responsibility: Finish the temperature field, map it onto the palette, and feather at the edge.
 * Boundary: Coarse warmth measurement stays in the vertex shaders; base colors stay with owners.
 *
 * This stage owns everything about the temperature that has to be finer than
 * the mesh: the two detail octaves, the localized hotspots, the surface slot's
 * own tone, and — on terrain only — the heat warm bodies leave on the ground.
 * The vertex stage contributes the coarse structure it can actually carry.
 */

uniform float thermalIntensity;
uniform float thermalRadiusMeters;
uniform float thermalEdgeFeatherMeters;
uniform float thermalEdgeBreakupMeters;
uniform vec4 thermalRampStops;
uniform float thermalSegmentEase;
uniform vec2 thermalHeatVisibility;
uniform vec3 thermalColdestColor;
uniform vec3 thermalColdColor;
uniform vec3 thermalCoolColor;
uniform vec3 thermalWarmColor;
uniform vec3 thermalHotColor;
uniform vec3 thermalHottestColor;
uniform vec2 thermalWarmthCeiling;
uniform float thermalToneWarmth;
uniform float thermalLuminanceReference;
uniform float thermalLuminanceAmount;
uniform float thermalMinimumShade;
uniform float thermalMaximumShade;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying float thermalSurfaceShade;

const vec3 THERMAL_LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

/*
 * The surface slot's own tone, on a perceptual rather than a linear scale. The
 * carried echo palette authors its dark stops close together, and in linear
 * light a trunk and a leaf are separated by four thousandths — far too little
 * to read. The square root is the cheap gamma spacing that pulls the dark end
 * apart again.
 */
float thermalSurfaceTone() {
  return sqrt(clamp(dot(diffuse, THERMAL_LUMINANCE_WEIGHTS), 0.0, 1.0));
}

/*
 * Keep the surface faintly visible through the false color, so a dark slot
 * stays darker than a pale one and a leaf's underside stays darker than its
 * top. Deliberately weak: a thermal camera has no albedo, and the per-part
 * identity that a lit scene would carry as color is carried as temperature
 * instead (see thermalToneWarmth). What is left here is the vertex stage's
 * hemispheric shade, which is the only thing in an unlit scene that shows
 * form, plus just enough tone not to lose a slot boundary entirely.
 *
 * The tone is read from the material's authored `diffuse` rather than the
 * incoming diffuseColor because the carried echo ramp runs before this effect
 * and at full intensity replaces diffuseColor outright with a pure
 * camera-distance value; `diffuse` is the last place surface identity exists.
 */
vec3 shadeBySurface(vec3 ramp, float tone) {
  float toneShade = mix(
    1.0,
    tone / thermalLuminanceReference,
    thermalLuminanceAmount
  );
  float shade =
    clamp(toneShade, thermalMinimumShade, thermalMaximumShade) *
    thermalSurfaceShade;
  return ramp * clamp(shade, thermalMinimumShade, thermalMaximumShade);
}

/*
 * The soft ceiling that separates the dead world from the living one. Below
 * the knee this is the identity; above it the value approaches the ceiling
 * asymptotically and never reaches it, so a slope that collects elevation,
 * exposure, mottling, and a ground heat pool compresses instead of clipping.
 * Clipping is what produced both failures it replaces: large regions parked on
 * one flat value, and ground reading hotter than the animal standing on it.
 *
 * Living bodies are given a knee at one, where warmth is already clamped, so
 * the same expression leaves them untouched without a second program.
 */
float thermalSoftCeiling(float warmth) {
  float range = max(thermalWarmthCeiling.y - thermalWarmthCeiling.x, 1e-4);
  float over = max(warmth - thermalWarmthCeiling.x, 0.0);
  return min(warmth, thermalWarmthCeiling.x) + range * (1.0 - exp(-over / range));
}

/* A linear rise across one segment, flat outside it. */
float thermalSegment(float warmth, float lowStop, float highStop) {
  return clamp((warmth - lowStop) / max(highStop - lowStop, 1e-4), 0.0, 1.0);
}

/*
 * Soften the slope corner at a stop without stalling the gradient there.
 *
 * The added cubic t(1-t)(2t-1) has derivative -1 at both ends of the segment,
 * so every segment leaves and enters its neighbours at the same slope 1 - ease
 * and the chained ramp is continuous in its first derivative: no Mach band at
 * a stop. Unlike a smoothstep that slope is never zero, so no pair of
 * neighbouring temperatures is ever parked on the same color — which is what
 * turns a ramp into visible bands. This holds only while the stops are evenly
 * spaced; the settings file spaces them and says why.
 */
float thermalEase(float progress) {
  return progress +
    thermalSegmentEase * progress * (1.0 - progress) * (2.0 * progress - 1.0);
}

/*
 * The palette, interpolated in gamma space: the uniforms arrive pre-encoded
 * and the result is squared back at the end. Interpolating the authored anchors
 * in linear light drags every crossing through a desaturated midpoint — the
 * cyan-to-magenta crossing in particular collapses into grey, which reads as a
 * dead zone between two solid color regions. In gamma space the path between
 * two anchors stays bright and saturated, which is where the intermediate
 * temperatures become legible as their own colors.
 */
vec3 thermalRampColor(float warmth) {
  vec3 ramp = mix(
    thermalColdestColor,
    thermalColdColor,
    thermalEase(thermalSegment(warmth, 0.0, thermalRampStops.x))
  );
  ramp = mix(
    ramp,
    thermalCoolColor,
    thermalEase(thermalSegment(warmth, thermalRampStops.x, thermalRampStops.y))
  );
  ramp = mix(
    ramp,
    thermalWarmColor,
    thermalEase(thermalSegment(warmth, thermalRampStops.y, thermalRampStops.z))
  );
  ramp = mix(
    ramp,
    thermalHotColor,
    thermalEase(thermalSegment(warmth, thermalRampStops.z, thermalRampStops.w))
  );
  ramp = mix(
    ramp,
    thermalHottestColor,
    thermalEase(thermalSegment(warmth, thermalRampStops.w, 1.0))
  );
  return ramp * ramp;
}

vec3 applyThermalPerception(vec3 baseColor) {
  float tone = thermalSurfaceTone();
  float warmth =
    interpolatedThermalWarmth +
    (tone - thermalLuminanceReference) * thermalToneWarmth;

  /*
   * The detail field is the one genuinely expensive thing this sense does per
   * fragment, and it runs on the largest fill-rate consumers in the scene. A
   * consumer whose detail amplitudes are all zero compiles none of it — the
   * octaves, the hotspot tail, and the edge breakup all disappear rather than
   * multiplying by zero. That is the lever to pull first if the PICO 4 frame
   * budget needs it, and it can be pulled per surface kind: grass carries the
   * worst overdraw in the scene and is the cheapest one to give up.
   */
  vec2 octaves = vec2(0.0);
#ifdef THERMAL_DETAIL
  octaves = thermalDetailOctaves();
  warmth +=
    thermalDetailWarmthAt(octaves, thermalViewDistance) +
    thermalHotspotWarmthAt(octaves);
#endif
#ifdef THERMAL_GROUND_HEAT
  warmth += thermalGroundHeat(thermalDetailPosition.xz, octaves.x);
#endif
  warmth = clamp(thermalSoftCeiling(warmth), 0.0, 1.0);

  // The sense reaches a fixed distance, and a fixed distance is a circle. The
  // detail field displaces the boundary so the heat view ends in a ragged
  // front that follows the surfaces it is fading out of.
  float senseReach = 1.0 - smoothstep(
    thermalRadiusMeters - thermalEdgeFeatherMeters,
    thermalRadiusMeters,
    thermalViewDistance + octaves.x * thermalEdgeBreakupMeters
  );
  /*
   * The cold end of the ramp is not a color at all: below the first stop the
   * false color is fully transparent and the carried echo depth map shows
   * through untouched, and it fades in to fully opaque by the second. Heat is
   * therefore a highlight inside the depth world rather than an image that
   * replaces it — cold ground and water keep the depth reading the viewer
   * already knows how to read, and a living body is the only thing solid
   * enough to hide it.
   *
   * This is a second, independent fade from the radius feather above, and the
   * two multiply: one bounds the sense in space, the other in temperature.
   */
  float heatVisibility = smoothstep(
    thermalHeatVisibility.x,
    thermalHeatVisibility.y,
    warmth
  );
  return mix(
    baseColor,
    shadeBySurface(thermalRampColor(warmth), tone),
    senseReach * thermalIntensity * heatVisibility
  );
}
