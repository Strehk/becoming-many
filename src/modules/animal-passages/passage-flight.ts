/**
 * Purpose: Fly one animal along its authored route, entry through departure.
 * Context: A passage is placed by the schedule, so its pose follows progress, not frames.
 * Responsibility: Own anchoring, route re-timing, the flight basis, and the exit curve.
 * Boundary: Route loading lives beside this file; placement in the show is the schedule's.
 */

import {
  type AnimationAction,
  AnimationClip,
  AnimationMixer,
  CatmullRomCurve3,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import type { PassageFlightDefinition } from "./passage-definitions";
import {
  END_DIRECTION_LOCK_SECONDS,
  type PassageRoute,
  samplePassageRoute,
} from "./passage-route";

/** Hide the animal a touch before the exit curve's end; it has left the frame. */
const EXIT_HIDE_PROGRESS = 0.94;
/** Time over which the approach's heading and speed ease into the route. */
const APPROACH_HANDOFF_BLEND_SECONDS = 2.4;
/** How far ahead the route is read to find the direction of travel. */
const LOOK_AHEAD_SECONDS = 0.08;
/** How far back it is read instead where the route has stopped moving. */
const LOOK_BACK_SECONDS = 0.14;
/** Fraction of the approach curve used to read its final tangent. */
const APPROACH_TANGENT_SPAN = 0.035;

export interface PassageFlightOptions {
  readonly definition: PassageFlightDefinition;
  readonly route: PassageRoute;
  /** The animal, already cloned and decorated by the module. */
  readonly model: Object3D;
  readonly animations: readonly AnimationClip[];
  readonly viewpoint: Viewpoint;
  readonly groundYAt: WorldSurface["groundYAt"];
  /** The direction the visitor is travelling, for routes that face them. */
  readonly readViewHeadingRadians: () => number;
}

export interface PassageFlight {
  /** The route frame; the module puts it in the scene and shows or hides it. */
  readonly root: Group;
  /** Total seconds from entry to departure — the schedule's authored length. */
  readonly durationSeconds: number;
  /**
   * Take the pose at this point in the crossing, 0..1. Everything the animal
   * does is derived from it, so the same progress always yields the same pose
   * and scrubbing lands mid-route rather than restarting the flight.
   */
  readonly applyProgress: (progress: number) => void;
  /** Face the route the way the visitor is travelling. Called on entry. */
  readonly anchor: () => void;
  readonly dispose: () => void;
}

export function createPassageFlight(
  options: PassageFlightOptions,
): PassageFlight {
  const { definition, route, viewpoint } = options;
  const root = new Group();
  root.name = `Passage:${definition.passageId}`;
  root.visible = false;

  const carrier = createCarrier(options.model, definition);
  root.add(options.model);

  const mixer = createMixer(options.model, options.animations, definition);
  const approachCurve = createApproachCurve(definition, route);
  const flightSeconds =
    definition.approachDurationSeconds + route.durationSeconds;
  const durationSeconds = flightSeconds + definition.exitDurationSeconds;

  /*
   * Two poses are read from the route rather than remembered from the frame
   * before: the orientation the approach hands over, and the pose the exit
   * curve grows out of. Both are pure functions of the route, so building
   * them the first time they are needed answers the same thing whether the
   * show played through to here or seeked straight into it.
   */
  let handoffQuaternion: Quaternion | undefined;
  let exitCurve: CatmullRomCurve3 | undefined;

  const heading = new Quaternion();
  const scratch = {
    position: new Vector3(),
    lookAt: new Vector3(),
    direction: new Vector3(),
    world: new Vector3(),
    quaternion: new Quaternion(),
    right: new Vector3(),
    up: new Vector3(),
    binormal: new Vector3(),
    matrix: new Matrix4(),
  };

  /**
   * Lift one route-space point only where it would put the animal below the
   * ground. Points already clear of the terrain are left exactly as authored.
   */
  function liftAboveGround(point: Vector3): void {
    if (definition.groundClearanceMeters <= 0) return;

    scratch.world.copy(point);
    root.localToWorld(scratch.world);
    const minimumY =
      options.groundYAt(scratch.world.x, scratch.world.z) +
      definition.groundClearanceMeters;
    if (scratch.world.y >= minimumY) return;

    scratch.world.y = minimumY;
    root.worldToLocal(scratch.world);
    point.copy(scratch.world);
  }

  /** An orthonormal basis whose +Y column is the direction of travel. */
  function orientationFor(direction: Vector3, target: Quaternion): Quaternion {
    if (direction.lengthSq() < 0.0001) return target;

    direction.normalize();
    scratch.up.set(0, 1, 0);
    // Near-vertical flight: swap the reference up, or the basis degenerates.
    if (Math.abs(direction.dot(scratch.up)) > 0.94) scratch.up.set(0, 0, 1);

    scratch.right.crossVectors(scratch.up, direction).normalize();
    scratch.binormal.crossVectors(scratch.right, direction).normalize();
    scratch.matrix.makeBasis(scratch.right, direction, scratch.binormal);
    return target.setFromRotationMatrix(scratch.matrix);
  }

  function faceDirection(direction: Vector3): void {
    if (direction.lengthSq() < 0.0001) return;
    orientationFor(direction, carrier.quaternion);
  }

  /**
   * Playback time to a distance-linear route time. The route opens at the
   * speed the approach arrives with and eases to a cruise chosen so it still
   * finishes on its authored length — an animal that arrives fast and then
   * crawls reads as two different animals.
   */
  function routeTimeAt(timeSeconds: number): number {
    const duration = Math.max(route.durationSeconds, 0.0001);
    const clamped = MathUtils.clamp(timeSeconds, 0, duration);
    if (!approachCurve || definition.approachDurationSeconds <= 0) {
      return clamped;
    }

    const blendSeconds = Math.min(APPROACH_HANDOFF_BLEND_SECONDS, duration);
    const maximumStartSpeed =
      (route.distanceMeters * 1.9) / Math.max(blendSeconds, 0.0001);
    const startSpeed = Math.min(
      approachCurve.getLength() / definition.approachDurationSeconds,
      maximumStartSpeed,
    );
    const cruiseSpeed =
      (route.distanceMeters - startSpeed * blendSeconds * 0.5) /
      Math.max(duration - blendSeconds * 0.5, 0.0001);

    let distance: number;
    if (clamped < blendSeconds) {
      const acceleration =
        (cruiseSpeed - startSpeed) / Math.max(blendSeconds, 0.0001);
      distance = startSpeed * clamped + acceleration * clamped * clamped * 0.5;
    } else {
      const blendDistance = (startSpeed + cruiseSpeed) * blendSeconds * 0.5;
      distance = blendDistance + cruiseSpeed * (clamped - blendSeconds);
    }

    return (
      MathUtils.clamp(distance / route.distanceMeters, 0, 1) *
      route.durationSeconds
    );
  }

  function applyApproachAt(timeSeconds: number): void {
    if (!approachCurve) return;

    const progress = MathUtils.clamp(
      timeSeconds / Math.max(definition.approachDurationSeconds, 0.0001),
      0,
      1,
    );
    approachCurve.getPointAt(progress, scratch.position);
    approachCurve.getPointAt(
      Math.min(progress + APPROACH_TANGENT_SPAN, 1),
      scratch.lookAt,
    );
    liftAboveGround(scratch.position);
    liftAboveGround(scratch.lookAt);
    carrier.position.copy(scratch.position);
    faceDirection(
      scratch.direction.subVectors(scratch.lookAt, scratch.position),
    );
  }

  /**
   * The orientation the approach ends on. Read as the curve's closing tangent
   * rather than from whatever the carrier happened to hold, so it is the same
   * value on a seek as on a play-through.
   */
  function getHandoffQuaternion(): Quaternion | undefined {
    if (!approachCurve) return undefined;
    if (handoffQuaternion) return handoffQuaternion;

    approachCurve.getPointAt(1, scratch.lookAt);
    approachCurve.getPointAt(1 - APPROACH_TANGENT_SPAN, scratch.position);
    handoffQuaternion = orientationFor(
      scratch.direction.subVectors(scratch.lookAt, scratch.position),
      new Quaternion(),
    ).clone();
    return handoffQuaternion;
  }

  /** Hold the approach's heading at the boundary, then ease into the route's. */
  function blendRouteEntry(timeSeconds: number): void {
    if (timeSeconds >= APPROACH_HANDOFF_BLEND_SECONDS) return;

    const handoff = getHandoffQuaternion();
    if (!handoff) return;

    const blend = MathUtils.smoothstep(
      timeSeconds,
      0,
      APPROACH_HANDOFF_BLEND_SECONDS,
    );
    scratch.quaternion.copy(carrier.quaternion);
    carrier.quaternion.copy(handoff).slerp(scratch.quaternion, blend);
  }

  function applyRouteAt(timeSeconds: number): void {
    const clamped = MathUtils.clamp(timeSeconds, 0, route.durationSeconds);
    samplePassageRoute(route, routeTimeAt(clamped), scratch.position);
    liftAboveGround(scratch.position);
    carrier.position.copy(scratch.position);

    samplePassageRoute(
      route,
      routeTimeAt(
        Math.min(clamped + LOOK_AHEAD_SECONDS, route.durationSeconds),
      ),
      scratch.lookAt,
    );
    liftAboveGround(scratch.lookAt);
    if (scratch.lookAt.distanceToSquared(scratch.position) < 0.0001) {
      // The route has stopped moving: read backwards and mirror it forwards.
      samplePassageRoute(
        route,
        routeTimeAt(Math.max(clamped - LOOK_BACK_SECONDS, 0)),
        scratch.lookAt,
      );
      liftAboveGround(scratch.lookAt);
      scratch.lookAt
        .subVectors(scratch.position, scratch.lookAt)
        .add(scratch.position);
      liftAboveGround(scratch.lookAt);
    }

    scratch.direction.subVectors(scratch.lookAt, scratch.position);
    // The authored track can wiggle at its very end; freeze the heading there
    // so the hand-off into the exit curve is stable.
    if (clamped >= route.durationSeconds - END_DIRECTION_LOCK_SECONDS) {
      scratch.direction.copy(route.endDirection);
    }
    faceDirection(scratch.direction);
    blendRouteEntry(timeSeconds);
  }

  /** The departure: a curve continuing the route's closing heading outward. */
  function getExitCurve(): CatmullRomCurve3 {
    if (exitCurve) return exitCurve;

    applyRouteAt(route.durationSeconds);
    const start = carrier.position.clone();
    const forward = new Vector3(0, 1, 0)
      .applyQuaternion(carrier.quaternion)
      .normalize();
    const lift = new Vector3(0, 1, 0);
    const outward = (metres: number, rise: number): Vector3 =>
      start
        .clone()
        .addScaledVector(forward, metres)
        .addScaledVector(lift, rise);

    exitCurve = new CatmullRomCurve3(
      [
        start,
        outward(4, 0.12),
        outward(11, 0.35),
        outward(24, 0.72),
        outward(55, 1.05),
      ],
      false,
      "centripetal",
      0.2,
    );
    return exitCurve;
  }

  function applyExitAt(timeSeconds: number): void {
    const curve = getExitCurve();
    const raw = MathUtils.clamp(
      timeSeconds / Math.max(definition.exitDurationSeconds, 0.0001),
      0,
      1,
    );
    // Ease in: a slow hand-off, then an accelerating departure.
    const progress = raw * raw;

    curve.getPointAt(progress, scratch.position);
    curve.getPointAt(Math.min(progress + 0.08, 1), scratch.lookAt);
    liftAboveGround(scratch.position);
    liftAboveGround(scratch.lookAt);
    carrier.position.copy(scratch.position);
    faceDirection(
      scratch.direction.subVectors(scratch.lookAt, scratch.position),
    );
    root.visible = raw < EXIT_HIDE_PROGRESS;
  }

  return {
    root,
    durationSeconds,

    anchor: (): void => {
      heading.identity();
      if (definition.alignToViewHeading) {
        heading.setFromAxisAngle(
          new Vector3(0, 1, 0),
          options.readViewHeadingRadians(),
        );
      }
      // The exit grows out of wherever the route ends over this ground, so it
      // is rebuilt per crossing rather than kept from the one before.
      exitCurve = undefined;
    },

    applyProgress: (progress: number): void => {
      // The route frame rides the visitor. A crossing authored around where
      // they are would otherwise be left behind within seconds of gliding.
      root.position.copy(viewpoint.worldPosition);
      root.quaternion.copy(heading);
      root.visible = true;

      const elapsed = MathUtils.clamp(progress, 0, 1) * durationSeconds;
      // The wingbeat is set from show time too, so a seek lands mid-flap
      // instead of restarting the wings under a body already in the air.
      mixer?.setTime(elapsed);

      if (approachCurve && elapsed < definition.approachDurationSeconds) {
        applyApproachAt(elapsed);
        return;
      }
      if (elapsed < flightSeconds) {
        applyRouteAt(elapsed - definition.approachDurationSeconds);
        return;
      }
      applyExitAt(elapsed - flightSeconds);
    },

    dispose: (): void => {
      root.removeFromParent();
      mixer?.stopAllAction();
    },
  };
}

/**
 * The entry arc, whose closing tangent matches the route's opening direction.
 * Position and heading stay continuous at the hand-off, so the animal joins
 * the authored route rather than snapping onto it. Passages without authored
 * entry points begin on the route itself.
 */
function createApproachCurve(
  definition: PassageFlightDefinition,
  route: PassageRoute,
): CatmullRomCurve3 | undefined {
  const entry = route.points[0];
  const next = route.points[1];
  if (
    definition.approachDurationSeconds <= 0 ||
    definition.approachPoints.length === 0 ||
    !entry ||
    !next
  ) {
    return undefined;
  }

  const routeDirection = next.clone().sub(entry);
  if (routeDirection.lengthSq() < 0.0001) routeDirection.set(0, 0, -1);
  else routeDirection.normalize();

  // Meet the route two and a half metres before its start, running the way it
  // runs, so the curve arrives already pointing along it.
  const handoff = entry.clone().addScaledVector(routeDirection, -2.5);
  const points = definition.approachPoints.map((point) => point.clone());
  const lastAuthored = points[points.length - 1];
  if (!lastAuthored || lastAuthored.distanceToSquared(handoff) > 0.01) {
    points.push(handoff);
  }
  points.push(entry.clone());
  return new CatmullRomCurve3(points, false, "centripetal", 0.35);
}

/**
 * Wrap the model so its own forward axis lines up with the flight basis. Every
 * animal is authored facing a different way; this is where that is corrected,
 * once, instead of in the route.
 */
function createCarrier(
  model: Object3D,
  definition: PassageFlightDefinition,
): Object3D {
  const visual = new Group();
  visual.name = "PassageVisualOrientation";
  visual.quaternion
    .setFromUnitVectors(
      definition.modelForward.clone().normalize(),
      new Vector3(0, 1, 0),
    )
    .premultiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        definition.modelRollOffsetRadians,
      ),
    );

  for (const child of [...model.children]) visual.add(child);
  model.add(visual);

  model.traverse((child) => {
    // The route hugs the visitor and skinned bounds drift off the animation;
    // a handful of parts is not worth a wrong cull this close to the eye.
    if (child instanceof Mesh) child.frustumCulled = false;
  });
  return model;
}

function createMixer(
  model: Object3D,
  animations: readonly AnimationClip[],
  definition: PassageFlightDefinition,
): AnimationMixer | undefined {
  const clip = definition.flapClipName
    ? AnimationClip.findByName([...animations], definition.flapClipName)
    : animations[0];
  if (!clip) return undefined;

  const mixer = new AnimationMixer(model);
  const action: AnimationAction = mixer.clipAction(clip);
  action.timeScale = definition.flapTimeScale;
  action.play();
  return mixer;
}
