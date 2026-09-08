/*
 * Purpose: Run one travelling wave down every snake body in the vertex stage.
 * Context: A pool of snakes shares one geometry; a skeleton each is not affordable.
 * Responsibility: Bend the body sideways by its place along it and this snake's phase.
 * Boundary: Where a snake is and which way it faces is written by the module.
 */

uniform float snakeTime;
uniform float snakeWaveLengths;
uniform float snakeWaveAmplitude;
uniform float snakeWaveSpeed;

// Zero at the head, one at the tail tip.
attribute float snakeAlongBody;
// This snake's own place in the wave, so no two crawl in step.
attribute float snakePhase;

vec3 applySnakeSlither(vec3 restingPosition) {
  const float TAU = 6.2831853;
  // The wave travels from head to tail, which is what pushes a snake forward
  // rather than making it wag: the head barely leaves the line it crawls on
  // and the body swings wider the further back it lies.
  float wave = sin(
    (snakeAlongBody * snakeWaveLengths - snakeTime * snakeWaveSpeed + snakePhase) * TAU
  );
  float reach = smoothstep(0.0, 0.35, snakeAlongBody);

  return vec3(
    restingPosition.x + wave * snakeWaveAmplitude * reach,
    restingPosition.y,
    restingPosition.z
  );
}
