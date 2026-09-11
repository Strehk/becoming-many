import type { Vector3 } from "three";

/** Borrowed world facts, refreshed before modules; consumers never mutate vectors. */
export interface Viewpoint {
  readonly worldPosition: Readonly<Vector3>;
  /** Rig motion excludes the local head pose and pitch assistance. */
  readonly worldFlightPosition?: Readonly<Vector3>;
  /** Actual frame displacement, normalized after height limits; rig heading at rest. */
  readonly worldFlightDirection?: Readonly<Vector3>;
  /** Rendered body axis before local mouse/head pose, including rig tilt on desktop. */
  readonly worldBodyDirection: Readonly<Vector3>;
  readonly worldDirection: Readonly<Vector3>;
  readonly worldUp: Readonly<Vector3>;
  readonly viewHalfAngleRadians: number;
  readonly viewDistanceMeters: number;
}
