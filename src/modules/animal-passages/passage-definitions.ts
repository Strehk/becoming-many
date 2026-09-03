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
  readonly frameYaw: PassageFrameYaw;
  /**
   * The compass bearing the departure turns onto, in radians clockwise from
   * north. Omit to leave on the route's own closing heading, which is what an
   * animal without a compass meaning does. The turn is a bank across the exit,
   * not a snap at the hand-off.
   */
  readonly departureBearingRadians?: number;
}

/**
 * Which way the whole route frame is turned as the animal enters — the entry
 * points, the route, and the departure together, so the tuned shape is
 * untouched and only its compass direction changes.
 *
 * `viewHeading` turns it to the way the visitor is travelling, for a crossing
 * that has to arrive from behind them wherever they happen to be pointed.
 * `world` holds an authored bearing regardless of the view, for one that means
 * something on the compass.
 */
export type PassageFrameYaw =
  | { readonly kind: "viewHeading" }
  | { readonly kind: "world"; readonly radians: number };

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
  frameYaw: { kind: "viewHeading" },
};

/** Every animal that crosses as a body flying an authored route. */
export const PASSAGE_FLIGHTS: readonly PassageFlightDefinition[] = [
  BAT_PASSAGE,
];

/**
 * One passage that crosses as a swarm rather than as a body. Nothing of it is
 * ever drawn: what the visitor sees is the trail its movement prints, which is
 * why it needs a cloud size and a route but no model, no wingspan, and no
 * forward axis.
 */
export interface PassageSwarmDefinition {
  readonly passageId: PassageId;
  readonly routeUrl: string;
  /** Seconds the crossing takes; the authored track is stretched to it. */
  readonly durationSeconds: number;
  readonly routeScaleToMeters: number;
  readonly axisStretch: Vector3;
  readonly routeStart: Vector3;
  /** How many points the cloud carries, and how far they spread around it. */
  readonly pointCount: number;
  readonly cloudRadiusMeters: number;
  readonly cloudHeightMeters: number;
  /*
   * The swarm prints at the level's own authored trail size. The predecessor
   * shrank its mosquito particles to just over a fifth, but that scale was
   * against a different renderer's base size and does not carry: at a fifth of
   * the mark authored here the cloud all but disappears at the three metres it
   * passes at. Rather than invent a replacement number, it prints as the level
   * says a trail prints.
   */
  /** Minimum height above ground for the swarm's centre. */
  readonly groundClearanceMeters: number;
}

/**
 * The mosquitoes, before Motion Perception. They enter two metres to the right
 * and two behind, pass at under three metres, and leave low and far — close
 * enough that their traces cross the whole view.
 *
 * The authored track is stretched wide across the view and shortened along it,
 * which is what makes the cloud read as passing *by* rather than as receding,
 * and its start height is the track's own zero, so the swarm enters at eye
 * level. Every value is carried over from the project it was tuned in; the
 * fifteen seconds are the track's seven and a half at the half speed it was
 * played back at.
 */
export const MOSQUITO_PASSAGE: PassageSwarmDefinition = {
  passageId: "mosquitoes",
  routeUrl: "/passages/mosquito-route.glb",
  durationSeconds: 15,
  routeScaleToMeters: 1,
  axisStretch: new Vector3(1.5, 1.5, 0.5),
  routeStart: new Vector3(2, 0, 2),
  pointCount: 220,
  cloudRadiusMeters: 1.6,
  cloudHeightMeters: 0.7,
  groundClearanceMeters: 0.8,
};
