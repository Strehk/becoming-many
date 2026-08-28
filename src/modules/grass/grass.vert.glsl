/*
 * Purpose: Place deterministic grass tufts and animate their tips on the GPU.
 * Context: Streamed CPU work supplies stable roots while ordinary frames update only time.
 * Responsibility: Apply per-tuft variation, rotation, height, and opaque wind deformation.
 * Boundary: World-surface sampling and chunk recycling remain in TypeScript.
 *
 * Sense contract: this shader carries the shared injection anchors, so a
 * material effect can decorate it exactly as it decorates a three.js material.
 * At the `project_vertex` anchor an effect may read `mvPosition`, plus three
 * values Grass publishes about the current vertex:
 *   transformed         the deformed vertex; this mesh sits at the world
 *                       origin, so it is already a world position
 *   grassBladeProgress  0 at the root, 1 at the tip
 *   grassSway           signed wind lean, strongest at the tip
 */

#include <common>

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
  // Rejected candidates used to return early. They now fall through and are
  // collapsed off screen at the end instead, because an early return would
  // skip the injected sense call and leave its varyings unwritten — and a
  // branchless cull suits the mobile target better than a divergent one.
  float hidden = step(grassInstance.w, -0.5);

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

  grassHeightProgress = position.y;
  float grassBladeProgress = position.y;
  float grassSway = wind * tipWeight;

  vec3 transformed = vec3(
    grassInstance.x + localPosition.x + windOffset.x,
    grassInstance.y + bladeHeight,
    grassInstance.z + localPosition.y + windOffset.y
  );

  // The mesh sits at the world origin, so modelViewMatrix is the view matrix
  // and the shared anchor projects these world-space tufts unchanged.
  #include <project_vertex>

  gl_Position = mix(gl_Position, vec4(2.0, 2.0, 2.0, 1.0), hidden);
}
