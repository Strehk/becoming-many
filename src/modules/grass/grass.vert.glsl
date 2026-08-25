/*
 * Purpose: Place deterministic grass tufts and animate their tips on the GPU.
 * Context: Streamed CPU work supplies stable roots while ordinary frames update only time.
 * Responsibility: Apply per-tuft variation, rotation, height, and opaque wind deformation.
 * Boundary: World-surface sampling and chunk recycling remain in TypeScript.
 */

attribute vec4 grassInstance;

uniform float grassTime;
uniform float grassMeadowHeight;
uniform float grassShrubSlopeHeightScale;
uniform vec2 grassWindDirection;
uniform float grassWindStrength;
uniform float grassWindSpeed;

varying float grassHeightProgress;

const float TAU = 6.28318530718;

vec2 rotateGrass(vec2 value, float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine) * value;
}

void main() {
  if (grassInstance.w < 0.0) {
    grassHeightProgress = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float zoneHeightScale = mix(
    1.0,
    grassShrubSlopeHeightScale,
    step(1.0, grassInstance.w)
  );
  float seed = fract(grassInstance.w);
  float heightVariation = mix(0.4, 1.0, fract(seed * 43.17));
  float tuftHeight = grassMeadowHeight * zoneHeightScale * heightVariation;
  vec2 localPosition = rotateGrass(position.xz, seed * TAU) * tuftHeight;
  float bladeHeight = position.y * tuftHeight;

  float windPhase = dot(grassInstance.xz, vec2(0.12, 0.09));
  windPhase += grassTime * grassWindSpeed + seed * TAU;
  float wind = sin(windPhase);
  wind += sin(windPhase * 0.37 - grassTime * grassWindSpeed * 0.43) * 0.32;
  float tipWeight = position.y * position.y;
  vec2 windOffset = grassWindDirection * wind * grassWindStrength *
    tuftHeight * tipWeight;

  vec3 worldPosition = vec3(
    grassInstance.x + localPosition.x + windOffset.x,
    grassInstance.y + bladeHeight,
    grassInstance.z + localPosition.y + windOffset.y
  );

  grassHeightProgress = position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
}
