// 1. A smooth random field: neighboring grains share the same changing air movement.
uniform float elementWindTime;
uniform float elementWindPeriod;
uniform float elementWindAmplitude;
uniform float elementWindIndividual;
uniform float elementWindCoherence;

vec3 windLattice(vec2 cell) {
  cell = mod(cell, elementWindPeriod);
  vec3 hash = fract(vec3(cell.x, cell.y, cell.x) * vec3(0.1031, 0.1030, 0.0973));
  hash += dot(hash, hash.yxz + 33.33);
  return fract((hash.xxy + hash.yxx) * hash.zyx) * 2.0 - 1.0;
}

// Quintic interpolation joins lattice cells without jumps in velocity or acceleration.
vec3 sampleWindField(vec2 coordinate) {
  vec2 cell = floor(coordinate);
  vec2 blend = fract(coordinate);
  blend = blend * blend * blend * (blend * (blend * 6.0 - 15.0) + 10.0);
  vec3 before = mix(windLattice(cell), windLattice(cell + vec2(1.0, 0.0)), blend.x);
  vec3 after = mix(windLattice(cell + vec2(0.0, 1.0)), windLattice(cell + vec2(1.0)), blend.x);
  return mix(before, after, blend.y);
}

// 2. Bounded drift preserves the ring, with a much smaller individual contribution.
vec3 sampleElementWind(vec3 restingPosition, float seed) {
  vec3 position = restingPosition / elementWindCoherence;
  vec2 field = vec2(dot(position, vec3(0.83, 0.41, 0.37)),
    elementWindTime + dot(position, vec3(0.19, 0.31, 0.23)));
  vec3 shared = sampleWindField(field);
  vec3 individual = sampleWindField(vec2(seed * 71.0, elementWindTime + seed * 13.0));
  return shared * elementWindAmplitude + individual * elementWindIndividual;
}
