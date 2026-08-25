/*
 * Purpose: Pass stable absolute terrain positions to the magnetic fragment shader.
 * Context: Field lines must remain anchored while terrain chunks recycle around the viewer.
 * Responsibility: Convert the current transformed terrain vertex into world space.
 * Boundary: Terrain owns displacement and geometry; field mathematics stays in the fragment shader.
 */

varying vec3 magneticWorldPosition;

void passMagneticWorldPosition(vec3 localPosition) {
  magneticWorldPosition = (modelMatrix * vec4(localPosition, 1.0)).xyz;
}
