/*
 * Purpose: Shade grass with one opaque unlit vertical color gradient.
 * Context: The landscape needs readable grass without lights, textures, or blending.
 * Responsibility: Color every tuft from its root to its tip.
 * Boundary: Magnetic perception and other narrative appearances stay outside Grass.
 */

uniform vec3 grassRootColor;
uniform vec3 grassTipColor;

varying float grassHeightProgress;

void main() {
  vec3 color = mix(grassRootColor, grassTipColor, grassHeightProgress);
  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
