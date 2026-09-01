/**
 * Purpose: Present the world surface as an invisible occluder.
 * Context: The Scent World keeps every source object unseen but must still hide what lies behind a hill.
 * Responsibility: Own the depth-only material and the coarse resolution that presentation needs.
 * Boundary: Geometry, streaming, and lifecycle stay in the Terrain module.
 */

import { MeshBasicMaterial } from "three";
import type { TerrainPresentation } from "./terrain-geometry";

/**
 * Coarse against the 32 segments a drawn surface uses. The occluder is never
 * seen, so it only has to carry ridges and valley edges; at 8 segments it
 * costs a sixteenth of the triangles and a fine ripple may let a single
 * particle show through where a drawn surface would have hidden it.
 */
export const GROUND_OCCLUDER_SEGMENTS_PER_SIDE = 8;

/**
 * Write depth but no color. The surface then hides whatever stands behind it
 * without being drawn, which is what "the terrain remains invisible" has to
 * mean once a sense fills the air in front of it: a scent map that shows the
 * far side of a ridge through the ridge is not a map of anything.
 */
export function createGroundOccluder(): TerrainPresentation {
  return {
    material: new MeshBasicMaterial({ colorWrite: false }),
    segmentsPerSide: GROUND_OCCLUDER_SEGMENTS_PER_SIDE,
  };
}
