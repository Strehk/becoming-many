/*
 * Purpose: Measure camera distance for the echo depth ramp.
 * Context: Depth cues must stay stable while the viewer flies and turns the headset.
 * Responsibility: Write the radial view distance of the current vertex.
 * Boundary: Ramp colors and mixing stay in the fragment shader; geometry stays with owners.
 */

varying float echoViewDistance;

void passEchoDepth(vec4 viewPosition) {
  echoViewDistance = length(viewPosition.xyz);
}
