// 1. Shared grain placement and per-element animation inputs
attribute float elementOpacity;
attribute float elementSeed;
attribute vec3 elementCenter;
attribute float grainIndex;
attribute float elementAxis;
attribute float elementIndex;
uniform vec3 elementEffects[ELEMENT_CAPACITY];
attribute vec3 elementDirection;
uniform float elementGrainSpread;
uniform float elementAccentFraction;
uniform float elementBandWidth;
uniform float elementGlassFraction;
uniform float elementDrift;
uniform float elementScatter;
varying float volumeOpacity;
varying float grainLight;
varying float grainGlass;

// 2. Sweep along local forward; successful elements drift and disperse independently
vec3 placeElementGrain(float seed) {
  vec3 elementEffect = elementEffects[int(elementIndex)];
  vec3 offset = vec3(sin(seed * 137.0), cos(seed * 93.0), sin(seed * 71.0));
  float wave = (elementAxis - elementEffect.x) / elementBandWidth;
  grainLight = exp(-wave * wave * 4.0) * elementEffect.y;
  grainGlass = 1.0 - step(elementGlassFraction, seed);
  volumeOpacity = elementOpacity * elementEffect.z;
  float dissolved = 1.0 - elementEffect.z;
  return elementCenter + offset * (elementGrainSpread * sqrt(seed) + dissolved * elementScatter)
    + elementDirection * dissolved * elementDrift;
}
