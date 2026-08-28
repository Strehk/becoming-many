/*
 * Purpose: Shade grass with one opaque unlit vertical color gradient.
 * Context: The landscape needs readable grass without lights, textures, or blending.
 * Responsibility: Color every tuft from its root to its tip.
 * Boundary: Magnetic perception and other narrative appearances stay outside Grass.
 *
 * Sense contract: the gradient is written into `diffuseColor` and published at
 * the shared `color_fragment` anchor, so a material effect can replace the
 * color the same way it does on a three.js material. `diffuse` carries the
 * tuft's representative tone for effects that read a material's base color.
 */

// Declared above the include because <common> is the shared injection point
// for material effects, and an effect that reads this tone is written in
// before anything declared below it.
uniform vec3 diffuse;

#include <common>

uniform vec3 grassRootColor;
uniform vec3 grassTipColor;

varying float grassHeightProgress;

void main() {
  vec4 diffuseColor = vec4(
    mix(grassRootColor, grassTipColor, grassHeightProgress),
    1.0
  );

  #include <color_fragment>

  gl_FragColor = diffuseColor;

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
