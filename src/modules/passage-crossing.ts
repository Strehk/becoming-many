/**
 * Purpose: Share the contract for a scheduled swarm crossing and the trails that print it.
 * Context: A passage that has no body is drawn by Motion Sense, which must not import it.
 * Responsibility: Type where the cloud stands this instant and what shape prints it.
 * Boundary: The route and the schedule stay with the passage; the ring stays with Motion Sense.
 */

import type { Vector3 } from "three";

/**
 * Where the swarm passage's centre is now and how long it has been crossing,
 * or undefined while it is away. The seconds are what every point's buzz is
 * derived from, so the cloud stays a pure function of show time: a seek lands
 * it mid-crossing rather than restarting it.
 *
 * Writes into the caller's vector; it runs on every frame of the show and must
 * not allocate.
 */
export type ReadSwarmCrossing = (centre: Vector3) => number | undefined;

/**
 * One scheduled swarm crossing, as the passage hands it to whatever draws it.
 * The cloud shape travels with the reader because both are authored against
 * the same crossing: a ring sized for a different cloud would print a swarm
 * that is not the one flying.
 */
export interface PassageSwarmCrossing {
  /** How many points the cloud carries, and how far they spread around it. */
  readonly pointCount: number;
  readonly cloudRadiusMeters: number;
  readonly cloudHeightMeters: number;
  readonly read: ReadSwarmCrossing;
}
