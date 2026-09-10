// 1. Shared grain placement and per-element animation inputs
attribute float elementOpacity;
attribute float elementSeed;
attribute vec3 elementCenter;
attribute float grainIndex;
attribute float elementAxis;
attribute float elementIndex;
uniform vec2 elementEffects[ELEMENT_CAPACITY];
uniform float elementPresence[ELEMENT_CAPACITY];
uniform float elementGrainSpread;
uniform float elementAccentFraction;
uniform float elementBandWidth;
uniform float elementGlassFraction;
varying float volumeOpacity;
varying float grainLight;
varying float grainGlass;

// 2. Sweep along local forward; visibility belongs to the whole section
vec3 placeElementGrain(float seed) {
  vec2 elementEffect = elementEffects[int(elementIndex)];
  vec3 offset = vec3(sin(seed * 137.0), cos(seed * 93.0), sin(seed * 71.0));
  float wave = (elementAxis - elementEffect.x) / elementBandWidth;
  grainLight = exp(-wave * wave * 4.0) * elementEffect.y;
  grainGlass = 1.0 - step(elementGlassFraction, seed);
  volumeOpacity = elementOpacity * elementPresence[int(elementIndex)];
  return elementCenter + offset * elementGrainSpread * sqrt(seed);
}
