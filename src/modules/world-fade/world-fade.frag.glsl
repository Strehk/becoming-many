/*
 * Purpose: Blend a sensed surface's final color toward the live background.
 * Context: World states fade in and out of the haze during a show.
 * Responsibility: Mix the finished fragment color by one presence value.
 * Boundary: What drives presence and background stays with the show driver.
 */

uniform float worldFadePresence;
uniform vec3 worldFadeBackground;

vec3 applyWorldFade(vec3 baseColor) {
  return mix(worldFadeBackground, baseColor, worldFadePresence);
}
