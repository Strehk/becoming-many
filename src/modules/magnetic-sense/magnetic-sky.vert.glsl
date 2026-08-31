/*
 * Purpose: Pass the view direction of the camera-centred sky dome to the fragment shader.
 * Context: The dome follows the camera, so local vertex positions are view directions.
 * Responsibility: Forward the local position and project the dome vertex.
 * Boundary: Glow mathematics and colors stay in the fragment shader.
 */

varying vec3 magneticSkyDirection;

void main() {
  magneticSkyDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
