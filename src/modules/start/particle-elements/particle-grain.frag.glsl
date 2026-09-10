// Individual dust grains use a restrained spherical shading cue and soft edges.
uniform float elementRelief;
varying float volumeOpacity;

vec4 shadeElementGrain(vec4 pigment) {
  vec2 disc = gl_PointCoord * 2.0 - 1.0;
  float radius = length(disc);
  float feather = max(fwidth(radius), 0.04);
  float coverage = 1.0 - smoothstep(1.0 - feather, 1.0, radius);
  vec3 normal = vec3(disc.x, -disc.y, sqrt(max(0.0, 1.0 - dot(disc, disc))));
  float light = max(0.0, dot(normal, normalize(vec3(-0.45, 0.65, 0.65))));
  pigment.rgb += vec3(light * light * elementRelief);
  pigment.a *= coverage * volumeOpacity;
  return pigment;
}
