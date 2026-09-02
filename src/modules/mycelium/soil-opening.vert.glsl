/*
 * Purpose: Hand the ground surface its streamed grass coverage.
 * Context: Terrain streams the sampler the opening declares, one value per vertex.
 * Responsibility: Pass that value to the fragment stage.
 * Boundary: The two opacities and the blend stay in the fragment shader.
 */

attribute float groundCover;
varying float connectionsGroundCover;

void passConnectionsSoil() {
  connectionsGroundCover = groundCover;
}
