/*
 * Purpose: Shade grass with one opaque unlit vertical color gradient.
 * Context: The landscape needs readable grass without lights, textures, or blending.
 * Responsibility: Color every tuft from its root to its tip.
 * Boundary: Sense responses are injected by the composition root, not authored here.
 *
 * The root-to-tip gradient is this module's own color. It reaches the frame
 * only below full sense intensity: a sense effect injected after
 * <color_fragment> takes `diffuseColor` from here and returns its own.
 */

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
