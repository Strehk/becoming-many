/**
 * Purpose: Author how each passage animal is built and where its route runs.
 * Context: Direction, distance, and timing were tuned against these exact routes.
 * Responsibility: Keep every value that shapes a crossing explicit in one place.
 * Boundary: Show placement is the schedule's; sampling and flight live beside this.
 */

import { Quaternion, Vector3 } from "three";
import type { PassageId } from "../../dramaturgy/passage-schedule";

/**
 * One animal flying an authored route. Every number here was tuned in the
 * predecessor project against these same route files, and the values are
 * carried over unchanged — the direction each animal comes from and how close
 * it passes is the tuning, so re-deriving it would be re-authoring it.
 */
export interface PassageFlightDefinition {
  readonly passageId: PassageId;
  readonly modelUrl: string;
  readonly routeUrl: string;
  /** Wingspan in metres; the model is scaled to it from its own bounds. */
  readonly wingspanMeters: number;
  /** Stretch the authored track to this length; omit to fly it as authored. */
  readonly routeDurationSeconds?: number;
  /** Seconds of entry flight before the authored route; zero for none. */
  readonly approachDurationSeconds: number;
  /** Entry points around the visitor; the route start is joined on a tangent. */
  readonly approachPoints: readonly Vector3[];
  readonly exitDurationSeconds: number;
  readonly routeScaleToMeters: number;
  readonly routeRotation: Quaternion;
  /** Where the route's first point sits relative to the visitor, in metres. */
  readonly routeStart: Vector3;
  /** The model's own nose axis, aligned to the flight basis at build time. */
  readonly modelForward: Vector3;
  readonly modelRollOffsetRadians: number;
  /** Names the wing clip; omit to use the model's first animation. */
  readonly flapClipName?: string;
  readonly flapTimeScale: number;
  /** Minimum height above ground; zero leaves the route untouched. */
  readonly groundClearanceMeters: number;
  /** Turn the whole route to the visitor's heading as the animal enters. */
  readonly alignToViewHeading: boolean;
}

/*
 * The bat's route was authored travelling in one direction and is turned so it
 * runs away from the visitor. Both literals are the first two samples of the
 * authored track, kept as written rather than folded into a finished
 * quaternion, so the rotation stays readable as what it is.
 */
const BAT_ROUTE_INITIAL_DIRECTION = new Vector3(
  3.2842657566070557 - 3.285576581954956,
  0,
  -2.6652441024780273 - -2.665073871612549,
).normalize();

/**
 * The bat, before Echolocation. It enters behind and to the right of the
 * visitor and is held clear of the ground, because its route runs low enough
 * to cut through a rise.
 */
export const BAT_PASSAGE: PassageFlightDefinition = {
  passageId: "bat",
  modelUrl: "/passages/bat.glb",
  routeUrl: "/passages/bat-route.glb",
  wingspanMeters: 0.7,
  routeDurationSeconds: 10.416667,
  approachDurationSeconds: 0,
  approachPoints: [],
  exitDurationSeconds: 6,
  // The route is scaled around its start, so it doubles in size while its
  // first point stays beside the visitor.
  routeScaleToMeters: 2,
  routeRotation: new Quaternion().setFromUnitVectors(
    BAT_ROUTE_INITIAL_DIRECTION,
    new Vector3(0, 0, -1),
  ),
  routeStart: new Vector3(
    3.285576581954956,
    1.0420538187026978,
    2.665073871612549,
  ),
  // The mesh flies nose-first along +X and carries its back on +Y. Once +X is
  // aligned to the flight basis this roll puts its back up rather than letting
  // the bat fly on its side.
  modelForward: new Vector3(1, 0, 0),
  modelRollOffsetRadians: -Math.PI / 2,
  flapClipName: "Armature.001Action",
  flapTimeScale: 1,
  groundClearanceMeters: 0.45,
  alignToViewHeading: true,
};

/**
 * The bird, before Magnetic Field Perception. It begins behind the visitor,
 * sweeps around their right side, and joins the authored circling route on a
 * tangent-matched arc in front of them. The route keeps a fixed world rotation
 * rather than following the view: it is the world's bird, not the visitor's.
 *
 * Every phase runs two and a half times as long as the first version that
 * read well, which is where the slow, wide sweep comes from.
 */
export const BIRD_PASSAGE: PassageFlightDefinition = {
  passageId: "bird",
  modelUrl: "/passages/bird.glb",
  routeUrl: "/passages/bird-route.fbx",
  wingspanMeters: 1.65,
  routeDurationSeconds: 7.5,
  approachDurationSeconds: 6,
  approachPoints: [
    new Vector3(0.8, 0.25, 6.2),
    new Vector3(4.2, 0.75, 2.4),
    new Vector3(3.3, 1.15, -2.8),
  ],
  exitDurationSeconds: 12,
  routeScaleToMeters: 0.00125,
  routeRotation: new Quaternion(),
  routeStart: new Vector3(-3.264, 0.0, -5.478),
  // The model's head faces −Z in the file.
  modelForward: new Vector3(0, 0, -1),
  modelRollOffsetRadians: Math.PI,
  flapClipName: "ArmatureAction",
  flapTimeScale: 1,
  groundClearanceMeters: 0,
  alignToViewHeading: false,
};

/** Every animal that crosses on a flown route. */
export const PASSAGE_FLIGHTS: readonly PassageFlightDefinition[] = [
  BAT_PASSAGE,
  BIRD_PASSAGE,
];
