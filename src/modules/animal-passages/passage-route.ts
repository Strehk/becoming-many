/**
 * Purpose: Load one authored passage route and sample it in route space.
 * Context: Every passage follows a track authored in Blender as a moving Empty.
 * Responsibility: Own route loading, the transform into metres, and time sampling.
 * Boundary: Anchoring, orientation, and the animal itself belong to the flight.
 */

import {
  type AnimationClip,
  FileLoader,
  type KeyframeTrack,
  type Quaternion,
  Vector3,
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Where an authored route sits in the frame that follows the visitor: the
 * track's own units scaled to metres, turned, and moved so its first point
 * lands where the animal should enter. These three values are what tune a
 * passage's direction and how close it comes, so they are authored per
 * passage and carried unchanged from the routes they were tuned against.
 */
export interface RouteTransform {
  /** Authored route units to metres. */
  readonly scaleToMeters: number;
  /** Fixed rotation applied to route deltas before the start offset. */
  readonly rotation: Quaternion;
  /** Where the route's first point sits, relative to the visitor. */
  readonly start: Vector3;
}

/**
 * One authored route, resampled into route-space metres and reparametrised to
 * constant speed across its playing duration. The authored track's own timing
 * is deliberately dropped here: the flight re-times the route itself, easing
 * from the approach speed into a cruise, and that only works over a route
 * whose samples are spaced by distance.
 */
export interface PassageRoute {
  readonly points: readonly Vector3[];
  /** Seconds at which each point is reached; ends at `durationSeconds`. */
  readonly times: readonly number[];
  readonly durationSeconds: number;
  readonly distanceMeters: number;
  /**
   * The heading over the route's last moments, sampled wide enough to ignore
   * the wobble an authored track can carry at its very end. The flight locks
   * onto it before handing over to the exit curve.
   */
  readonly endDirection: Vector3;
}

/** Freeze the flight direction over the route's last moments. */
export const END_DIRECTION_LOCK_SECONDS = 0.45;

/**
 * Load a route authored as an animated Empty. Both formats the authoring
 * pipeline produces are read, sniffed from the header rather than the
 * extension: the bat and mosquito routes are glTF, the bird's circling route
 * is the one FBX in the repository and stays in that format so its tuned path
 * is the original samples rather than a re-export.
 *
 * `durationSeconds` stretches or compresses the track; omit it to fly the
 * route at its authored length.
 */
export async function loadPassageRoute(
  url: string,
  transform: RouteTransform,
  durationSeconds?: number,
): Promise<PassageRoute> {
  const clip = await loadRouteClip(url);
  const positionTrack = clip.tracks.find((track) =>
    track.name.endsWith(".position"),
  );
  if (!positionTrack) {
    throw new Error(`Passage route has no position track: ${url}`);
  }

  return buildRoute(
    positionTrack,
    transform,
    durationSeconds ?? clip.duration,
    clip.duration,
  );
}

/**
 * Where the route stands at a time inside its duration, in route space. Points
 * are spaced by distance, so a linear walk between the two surrounding samples
 * is the constant-speed position and no curve fitting is needed.
 */
export function samplePassageRoute(
  route: PassageRoute,
  timeSeconds: number,
  target: Vector3,
): Vector3 {
  const { points, times } = route;
  const first = points[0];
  if (!first) return target.set(0, 0, 0);

  const lastIndex = points.length - 1;
  const last = points[lastIndex] as Vector3;
  if (points.length === 1 || timeSeconds <= (times[0] ?? 0)) {
    return target.copy(first);
  }
  if (timeSeconds >= (times[lastIndex] ?? 0)) return target.copy(last);

  for (let index = 0; index < lastIndex; index += 1) {
    const startTime = times[index] ?? 0;
    const endTime = times[index + 1] ?? 0;
    if (timeSeconds < startTime || timeSeconds > endTime) continue;

    const segmentProgress =
      (timeSeconds - startTime) / Math.max(endTime - startTime, 0.0001);
    return target
      .copy(points[index] as Vector3)
      .lerp(points[index + 1] as Vector3, segmentProgress);
  }
  return target.copy(last);
}

async function loadRouteClip(url: string): Promise<AnimationClip> {
  const fileLoader = new FileLoader();
  fileLoader.setResponseType("arraybuffer");
  const buffer = (await fileLoader.loadAsync(url)) as ArrayBuffer;
  const basePath = url.slice(0, url.lastIndexOf("/") + 1);
  const header = new TextDecoder().decode(
    new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 24)),
  );

  const animations = header.startsWith("Kaydara FBX")
    ? new FBXLoader().parse(buffer, basePath).animations
    : await parseGltfAnimations(buffer, basePath);

  const clip = animations.find((candidate) =>
    candidate.tracks.some((track) => track.name.endsWith(".position")),
  );
  if (!clip) throw new Error(`Passage route carries no animation: ${url}`);
  return clip;
}

function parseGltfAnimations(
  buffer: ArrayBuffer,
  basePath: string,
): Promise<AnimationClip[]> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer,
      basePath,
      (gltf) => resolve(gltf.animations),
      reject,
    );
  });
}

function buildRoute(
  positionTrack: KeyframeTrack,
  transform: RouteTransform,
  durationSeconds: number,
  sourceDurationSeconds: number,
): PassageRoute {
  const values = positionTrack.values;
  const origin = new Vector3(values[0], values[1], values[2]);
  const points: Vector3[] = [];
  for (let index = 0; index < values.length; index += 3) {
    points.push(
      toRouteSpace(
        new Vector3(values[index], values[index + 1], values[index + 2]),
        origin,
        transform,
      ),
    );
  }

  // Space the samples by distance so the flight can re-time the route.
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    distances.push(
      (distances[index - 1] ?? 0) +
        (previous && current ? previous.distanceTo(current) : 0),
    );
  }
  const distanceMeters = Math.max(distances[distances.length - 1] ?? 0, 0.0001);

  return {
    points,
    times: distances.map(
      (distance) => (distance / distanceMeters) * durationSeconds,
    ),
    durationSeconds,
    distanceMeters,
    endDirection: readEndDirection(
      positionTrack,
      origin,
      transform,
      sourceDurationSeconds,
    ),
  };
}

function toRouteSpace(
  point: Vector3,
  origin: Vector3,
  transform: RouteTransform,
): Vector3 {
  return point
    .sub(origin)
    .multiplyScalar(transform.scaleToMeters)
    .applyQuaternion(transform.rotation)
    .add(transform.start);
}

function readEndDirection(
  positionTrack: KeyframeTrack,
  origin: Vector3,
  transform: RouteTransform,
  sourceDurationSeconds: number,
): Vector3 {
  const fromTime = Math.max(sourceDurationSeconds - 0.55, 0);
  const toTime = Math.max(sourceDurationSeconds - 0.18, fromTime + 0.01);
  const from = toRouteSpace(
    sampleTrackAt(positionTrack, fromTime),
    origin,
    transform,
  );
  const to = toRouteSpace(
    sampleTrackAt(positionTrack, toTime),
    origin,
    transform,
  );

  const direction = to.sub(from);
  return direction.lengthSq() < 0.0001
    ? new Vector3(0, 1, 0)
    : direction.normalize();
}

/** Linearly sample a Vector3 keyframe track at its own authored timing. */
function sampleTrackAt(track: KeyframeTrack, timeSeconds: number): Vector3 {
  const { times, values } = track;
  const readAt = (index: number): Vector3 =>
    new Vector3(
      values[index * 3] ?? 0,
      values[index * 3 + 1] ?? 0,
      values[index * 3 + 2] ?? 0,
    );

  const lastIndex = times.length - 1;
  if (timeSeconds <= (times[0] ?? 0)) return readAt(0);
  if (timeSeconds >= (times[lastIndex] ?? 0)) return readAt(lastIndex);

  for (let index = 0; index < lastIndex; index += 1) {
    const startTime = times[index] ?? 0;
    const endTime = times[index + 1] ?? 0;
    if (timeSeconds < startTime || timeSeconds > endTime) continue;

    const progress =
      (timeSeconds - startTime) / Math.max(endTime - startTime, 0.0001);
    return readAt(index).lerp(readAt(index + 1), progress);
  }
  return readAt(lastIndex);
}
