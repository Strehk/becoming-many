// Individual dust grains use a restrained spherical shading cue and soft edges.
uniform float elementRelief;
varying float volumeOpacity;
uniform vec3 elementLightColor;
varying float grainLight;
varying float grainGlass;

// Warm luminous centers with a sharp glass-like glint; no extra lighting pass.
vec3 illuminateGrain(vec3 pigment, vec3 normal, float radius) {
  float core = exp(-radius * radius * 5.0);
  float glint = pow(max(0.0, dot(normal, normalize(vec3(-0.35, 0.45, 0.82)))), 24.0);
  vec3 glow = mix(elementLightColor, vec3(1.0), core * 0.75);
  float intensity = grainLight * mix(0.35, 1.0, grainGlass);
  return mix(pigment, glow, intensity) + vec3(glint * grainGlass * grainLight * 0.6);
}

vec4 shadeElementGrain(vec4 pigment) {
  vec2 disc = gl_PointCoord * 2.0 - 1.0;
  float radius = length(disc);
  float feather = max(fwidth(radius), 0.04);
  float coverage = 1.0 - smoothstep(1.0 - feather, 1.0, radius);
  vec3 normal = vec3(disc.x, -disc.y, sqrt(max(0.0, 1.0 - dot(disc, disc))));
  float light = max(0.0, dot(normal, normalize(vec3(-0.45, 0.65, 0.65))));
  pigment.rgb += vec3(light * light * elementRelief);
  pigment.rgb = illuminateGrain(pigment.rgb, normal, radius);
  pigment.a *= coverage * volumeOpacity;
  return pigment;
}
