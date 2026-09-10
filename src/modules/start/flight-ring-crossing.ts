/** World-space metre coordinates; learning rules never receive rendering buffers. */
export interface FlightPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Intersect a movement segment with a ring's open disk, in either direction.
 * Starting on the plane is not a second crossing. The caller latches success
 * for the active goal; a long frame still tests the complete travelled segment.
 */
export function crossesFlightRing(
  previous: FlightPosition,
  current: FlightPosition,
  center: FlightPosition,
  normal: FlightPosition,
  radiusMeters: number,
): boolean {
  const before =
    (previous.x - center.x) * normal.x +
    (previous.y - center.y) * normal.y +
    (previous.z - center.z) * normal.z;
  const after =
    (current.x - center.x) * normal.x +
    (current.y - center.y) * normal.y +
    (current.z - center.z) * normal.z;
  if (before === 0 || before * after > 0) return false;
  const fraction = before / (before - after);
  const x = previous.x + (current.x - previous.x) * fraction - center.x;
  const y = previous.y + (current.y - previous.y) * fraction - center.y;
  const z = previous.z + (current.z - previous.z) * fraction - center.z;
  return x * x + y * y + z * z < radiusMeters * radiusMeters;
}
