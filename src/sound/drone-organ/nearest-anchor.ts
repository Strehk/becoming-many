/**
 * Purpose: Find the nearest of a group of world points to the listener.
 * Context: A placed layer sounds from the closest cloud of its group, and
 *   glides across to the next one as the visitor travels.
 * Responsibility: Scan packed xyz triples and report the closest.
 * Boundary: Who produces the points, and how the sound follows them, is
 *   decided by the caller.
 */

export interface AnchorPoint {
  x: number;
  y: number;
  z: number;
}

/** Values per packed point; the caller's arrays are tightly packed xyz. */
const COMPONENTS_PER_POINT = 3;

/**
 * Write the nearest packed point into `out`. Returns false when the group is
 * empty — a level without that content, or a module not yet loaded — and
 * leaves `out` untouched.
 */
export function readNearestAnchor(
  points: Float32Array,
  from: Readonly<AnchorPoint>,
  out: AnchorPoint,
): boolean {
  let nearestOffset = -1;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (
    let offset = 0;
    offset + COMPONENTS_PER_POINT <= points.length;
    offset += COMPONENTS_PER_POINT
  ) {
    const deltaX = (points[offset] ?? 0) - from.x;
    const deltaY = (points[offset + 1] ?? 0) - from.y;
    const deltaZ = (points[offset + 2] ?? 0) - from.z;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
    if (distanceSquared >= nearestDistanceSquared) continue;

    nearestDistanceSquared = distanceSquared;
    nearestOffset = offset;
  }

  if (nearestOffset < 0) return false;

  out.x = points[nearestOffset] ?? 0;
  out.y = points[nearestOffset + 1] ?? 0;
  out.z = points[nearestOffset + 2] ?? 0;
  return true;
}
