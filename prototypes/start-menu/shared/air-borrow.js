/**
 * Purpose: Let the menu's figures borrow the White World's own air particles.
 * Context: The tutorial's rule: a sign is not drawn in front of the world, it
 *   is a passing order inside it. Every figure, the title and the cursor are
 *   made of the very particles that give the white its depth: a particle is
 *   taken where it floats, flies into the figure, and later flies back home.
 *   Where a figure forms, the air around it visibly thins.
 * Responsibility: Hide a borrowed particle in the Air Particles cloud and draw
 *   it, at the identical spot and size, in a stand-in cloud that can move;
 *   fly stand-ins between home and figure; give them back seamlessly.
 * Boundary: Which particles a figure wants and where they go belong to the
 *   figure. Nothing in src/ imports this file.
 */

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
} from "three";
import { createAirParticleMaterial } from "../../../src/modules/start/point-cloud/point-cloud-material";
import { AIR_PARTICLES_SETTINGS } from "../../../src/modules/start/point-cloud/point-cloud-settings";
import { airParticleRecipe } from "./air-world.js";

const TAU = Math.PI * 2;
export const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const easeInOutCubic = (u) =>
  u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
export const easeOutCubic = (u) => 1 - (1 - u) ** 3;
export const hash = (index, salt = 0) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Particles beyond this or behind the eye cannot be seen. */
const NEAR_METERS = 0.6;

export function createAirBorrow(world, { capacity = 2600 } = {}) {
  const { camera, scene } = world;
  let cloud;
  scene.traverse((node) => {
    if (
      !cloud &&
      node.isPoints &&
      node.geometry.getAttribute("airParticleVisible")
    )
      cloud = node;
  });
  if (!cloud) throw new Error("The Air Particles cloud is not in the scene");
  const airPositions = cloud.geometry.getAttribute("position");
  const airVisible = cloud.geometry.getAttribute("airParticleVisible");
  const airCount = airVisible.count;
  const recipe = airParticleRecipe();
  const motion = recipe.motion;
  const sizeMeters = recipe.appearance.sizeMeters;

  // The cloud's drift runs on the GPU from one time uniform. Reading that
  // uniform lets a stand-in sit exactly where its particle is drawn.
  let timeUniform;
  const material = cloud.material;
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    timeUniform = shader.uniforms.airParticleTime;
  };
  let ownClock = 0;
  let driftTime = 0;
  const drift = { x: 0, y: 0 };
  const driftAt = (x, y, z) => {
    const phase = x * 0.071 + y * 0.113 + z * 0.053;
    drift.y =
      Math.sin(driftTime * 0.45 + phase) * motion.verticalAmplitudeMeters;
    drift.x =
      Math.cos(driftTime * 0.31 + phase * 1.7) *
      motion.horizontalAmplitudeMeters;
    return drift;
  };

  // The stand-ins: the same material recipe without the drift, which the
  // CPU applies itself, so a held figure stands still.
  const standIn = createAirParticleMaterial({
    appearance: recipe.appearance,
    motion: {
      horizontalAmplitudeMeters: 0,
      verticalAmplitudeMeters: 0,
      speedMultiplier: 0,
    },
  });
  const positions = new Float32Array(capacity * 3);
  const shown = new Float32Array(capacity);
  const geometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(positions, 3);
  const shownAttribute = new BufferAttribute(shown, 1);
  positionAttribute.setUsage(DynamicDrawUsage);
  shownAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("airParticleVisible", shownAttribute);
  geometry.setDrawRange(0, 0);
  const points = new Points(geometry, standIn.pointsMaterial);
  points.frustumCulled = false;
  scene.add(points);

  const borrowed = new Uint8Array(airCount);
  const active = [];
  let dirtyLow = Number.POSITIVE_INFINITY;
  let dirtyHigh = -1;
  const markAir = (index, value) => {
    airVisible.array[index] = value;
    if (index < dirtyLow) dirtyLow = index;
    if (index > dirtyHigh) dirtyHigh = index;
  };

  // View helpers
  const view = { width: 1, height: 1, tanHalf: 1, now: 0 };
  const readView = () => {
    const element = world.renderer.domElement;
    view.width = element.clientWidth || window.innerWidth;
    view.height = element.clientHeight || window.innerHeight;
    view.tanHalf = Math.tan((camera.fov * Math.PI) / 360);
  };
  readView();
  /** Metres per CSS pixel on a plane at this depth in front of the eye. */
  const metersPerPixel = (depth) => (depth * view.tanHalf) / (view.height / 2);
  /** The depth at which a particle is drawn this many CSS pixels wide. */
  const depthForPixels = (pixels) => (sizeMeters * (view.height / 2)) / pixels;
  /** Camera-local point for a screen position (CSS px) at a depth. */
  const localAt = (sx, sy, depth, out) => {
    const k = metersPerPixel(depth);
    out.x = (sx - view.width / 2) * k;
    out.y = -(sy - view.height / 2) * k;
    out.z = -depth;
    return out;
  };

  const m = camera.matrixWorld.elements;
  const mi = camera.matrixWorldInverse.elements;
  const toWorld = (x, y, z, out) => {
    out.x = m[0] * x + m[4] * y + m[8] * z + m[12];
    out.y = m[1] * x + m[5] * y + m[9] * z + m[13];
    out.z = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
  };
  const toLocal = (x, y, z, out) => {
    out.x = mi[0] * x + mi[4] * y + mi[8] * z + mi[12];
    out.y = mi[1] * x + mi[5] * y + mi[9] * z + mi[13];
    out.z = mi[2] * x + mi[6] * y + mi[10] * z + mi[14];
    return out;
  };
  const screenOf = (local, out) => {
    const depth = -local.z;
    const k = view.height / 2 / (depth * view.tanHalf);
    out.sx = view.width / 2 + local.x * k;
    out.sy = view.height / 2 - local.y * k;
    out.depth = depth;
    return out;
  };
  const sees = (local, margin = 40) => {
    if (local.z > -NEAR_METERS) return false;
    const depth = -local.z;
    if (depth > camera.far) return false;
    const k = view.height / 2 / (depth * view.tanHalf);
    const sx = local.x * k;
    const sy = local.y * k;
    return (
      Math.abs(sx) < view.width / 2 + margin &&
      Math.abs(sy) < view.height / 2 + margin
    );
  };

  // Candidates: every free particle in reach, with its camera-local point.
  const candidate = {
    count: 0,
    index: new Int32Array(airCount),
    lx: new Float32Array(airCount),
    ly: new Float32Array(airCount),
    lz: new Float32Array(airCount),
    sx: new Float32Array(airCount),
    sy: new Float32Array(airCount),
    visible: new Uint8Array(airCount),
    at: -1,
  };
  /**
   * Free air particles in front of the eye, within maxMeters. Cached for
   * maxAge seconds; a figure that wants many reads it once.
   */
  function candidates({ maxMeters = 128, maxAge = 0 } = {}) {
    if (view.now - candidate.at <= maxAge && candidate.max === maxMeters)
      return candidate;
    candidate.at = view.now;
    candidate.max = maxMeters;
    const array = airPositions.array;
    const visible = airVisible.array;
    const max2 = maxMeters * maxMeters;
    const reject2 = (maxMeters + 1) * (maxMeters + 1);
    const halfW = view.width / 2;
    const halfH = view.height / 2;
    let count = 0;
    for (let index = 0; index < airCount; index += 1) {
      if (visible[index] < 0.5 || borrowed[index]) continue;
      const hx = array[index * 3];
      const hy = array[index * 3 + 1];
      const hz = array[index * 3 + 2];
      // Cheap reject before the drift and the matrix: too far from the eye.
      const ex = hx - m[12];
      const ey = hy - m[13];
      const ez = hz - m[14];
      if (ex * ex + ey * ey + ez * ez > reject2) continue;
      const d = driftAt(hx, hy, hz);
      const x = hx + d.x;
      const y = hy + d.y;
      const lz = mi[2] * x + mi[6] * y + mi[10] * hz + mi[14];
      if (lz > -NEAR_METERS) continue;
      const lx = mi[0] * x + mi[4] * y + mi[8] * hz + mi[12];
      const ly = mi[1] * x + mi[5] * y + mi[9] * hz + mi[13];
      if (lx * lx + ly * ly + lz * lz > max2) continue;
      const k = halfH / (-lz * view.tanHalf);
      const sx = halfW + lx * k;
      const sy = halfH - ly * k;
      candidate.index[count] = index;
      candidate.lx[count] = lx;
      candidate.ly[count] = ly;
      candidate.lz[count] = lz;
      candidate.sx[count] = sx;
      candidate.sy[count] = sy;
      candidate.visible[count] = Number(
        -lz < camera.far &&
          sx > 0 &&
          sx < view.width &&
          sy > 0 &&
          sy < view.height,
      );
      count += 1;
    }
    candidate.count = count;
    return candidate;
  }

  // Stand-ins
  /** Borrow one air particle by its index; the stand-in starts where it floats. */
  function take(airIndex, owner) {
    if (active.length >= capacity || borrowed[airIndex]) return null;
    const array = airPositions.array;
    const hx = array[airIndex * 3];
    const hy = array[airIndex * 3 + 1];
    const hz = array[airIndex * 3 + 2];
    const d = driftAt(hx, hy, hz);
    const proxy = {
      slot: active.length,
      air: airIndex,
      owner,
      hx,
      hy,
      hz,
      x: hx + d.x,
      y: hy + d.y,
      z: hz,
      target: null,
      home: true,
      hidden: false,
      flying: false,
      fx: 0,
      fy: 0,
      fz: 0,
      bx: 0,
      by: 0,
      bz: 0,
      start: 0,
      duration: 1,
      ease: easeInOutCubic,
      onArrive: null,
      data: {},
    };
    // Fresh borrowings rest at home until a figure gives them a target.
    proxy.home = false;
    proxy.target = restTarget;
    borrowed[airIndex] = 1;
    markAir(airIndex, 0);
    active.push(proxy);
    return proxy;
  }

  // A borrowed particle without a figure floats exactly as at home.
  const restTarget = (proxy, out) => {
    const d = driftAt(proxy.hx, proxy.hy, proxy.hz);
    out.x = proxy.hx + d.x;
    out.y = proxy.hy + d.y;
    out.z = proxy.hz;
    out.world = true;
    return out;
  };

  const bendScratch = { x: 0, y: 0, z: 0 };
  /**
   * Fly the stand-in from where it is to a target. target(proxy, out, now)
   * writes a point into out: camera-local unless out.world is set.
   * Options: delay, duration, bend (share of the distance), ease, onArrive.
   */
  function send(proxy, target, options = {}) {
    const now = view.now;
    proxy.target = target ?? restTarget;
    proxy.home = !target;
    proxy.flying = true;
    proxy.fx = proxy.x;
    proxy.fy = proxy.y;
    proxy.fz = proxy.z;
    proxy.start = now + (options.delay ?? 0);
    proxy.duration = Math.max(options.duration ?? 1.4, 0.001);
    proxy.ease = options.ease ?? easeInOutCubic;
    proxy.onArrive = options.onArrive ?? null;
    // A sideways bow, perpendicular to the path, so flights read as flight.
    const dest = resolve(proxy, bendScratch);
    const dx = dest.x - proxy.x;
    const dy = dest.y - proxy.y;
    const dz = dest.z - proxy.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    const amount = (options.bend ?? 0.16) * length;
    const salt = proxy.air >= 0 ? proxy.air : proxy.slot;
    let rx = hash(salt, 41) - 0.5;
    let ry = hash(salt, 42) - 0.5;
    let rz = hash(salt, 43) - 0.5;
    const along = (rx * dx + ry * dy + rz * dz) / (length * length);
    rx -= along * dx;
    ry -= along * dy;
    rz -= along * dz;
    const norm = Math.hypot(rx, ry, rz) || 1;
    proxy.bx = (rx / norm) * amount;
    proxy.by = (ry / norm) * amount;
    proxy.bz = (rz / norm) * amount;
    if (proxy.home) steerAroundEye(proxy, dest, length);
  }

  // Going home behind the eye must not pass through it: bow outward instead.
  const localA = { x: 0, y: 0, z: 0 };
  const localB = { x: 0, y: 0, z: 0 };
  function steerAroundEye(proxy, dest, length) {
    toLocal(proxy.x, proxy.y, proxy.z, localA);
    toLocal(dest.x, dest.y, dest.z, localB);
    if (localB.z < -8 && localA.z < -2) return;
    let ox = localA.x;
    let oy = localA.y;
    const radial = Math.hypot(ox, oy);
    if (radial < 0.5) {
      const angle = hash(proxy.air, 44) * TAU;
      ox = Math.cos(angle);
      oy = Math.sin(angle);
    } else {
      ox /= radial;
      oy /= radial;
    }
    const amount = Math.max(14, length * 0.7);
    // Rotate the camera-local direction into the world.
    proxy.bx = (m[0] * ox + m[4] * oy) * amount;
    proxy.by = (m[1] * ox + m[5] * oy) * amount;
    proxy.bz = (m[2] * ox + m[6] * oy) * amount;
  }

  /** Send home, fly back, and give the particle back to the cloud. */
  function release(proxy, options = {}) {
    send(proxy, null, {
      duration: 2.6,
      bend: 0.12,
      ...options,
    });
  }

  function resolve(proxy, out) {
    out.world = false;
    proxy.target(proxy, out, view.now);
    if (!out.world) toWorld(out.x, out.y, out.z, out);
    return out;
  }

  function finish(proxy) {
    if (proxy.air >= 0) {
      borrowed[proxy.air] = 0;
      markAir(proxy.air, 1);
    }
    proxy.gone = true;
    const last = active.pop();
    if (last !== proxy) {
      last.slot = proxy.slot;
      active[proxy.slot] = last;
    }
  }

  const dest = { x: 0, y: 0, z: 0, world: false };
  const homeLocal = { x: 0, y: 0, z: 0 };
  // Figures run before the stand-ins move, so a change shows the same frame.
  const updateHooks = [];
  function update(scaledSeconds, nowSeconds) {
    view.now = nowSeconds;
    readView();
    for (const hook of updateHooks) hook(nowSeconds, scaledSeconds);
    ownClock =
      (ownClock + scaledSeconds) % AIR_PARTICLES_SETTINGS.animationLoopSeconds;
    driftTime = timeUniform
      ? (timeUniform.value + scaledSeconds * motion.speedMultiplier) %
        AIR_PARTICLES_SETTINGS.animationLoopSeconds
      : ownClock;
    const array = airPositions.array;
    for (let n = active.length - 1; n >= 0; n -= 1) {
      const proxy = active[n];
      // The cloud recycled this particle's volume: its home is gone; the
      // stand-in is now the only copy and leaves once it is out of sight.
      if (
        proxy.air >= 0 &&
        (array[proxy.air * 3] !== proxy.hx ||
          array[proxy.air * 3 + 2] !== proxy.hz)
      ) {
        borrowed[proxy.air] = 0;
        proxy.air = -1;
      }
      resolve(proxy, dest);
      if (proxy.flying) {
        const u = clamp01((nowSeconds - proxy.start) / proxy.duration);
        const e = proxy.ease(u);
        const bow = Math.sin(Math.PI * u);
        proxy.x = proxy.fx + (dest.x - proxy.fx) * e + proxy.bx * bow;
        proxy.y = proxy.fy + (dest.y - proxy.fy) * e + proxy.by * bow;
        proxy.z = proxy.fz + (dest.z - proxy.fz) * e + proxy.bz * bow;
        if (u >= 1) {
          proxy.flying = false;
          const arrive = proxy.onArrive;
          proxy.onArrive = null;
          if (arrive) arrive(proxy);
        }
      } else {
        proxy.x = dest.x;
        proxy.y = dest.y;
        proxy.z = dest.z;
      }
      if (proxy.home) {
        if (!proxy.flying) {
          finish(proxy);
          continue;
        }
        // Once neither the stand-in nor its home can be seen, it is home.
        toLocal(proxy.x, proxy.y, proxy.z, localA);
        toLocal(proxy.hx, proxy.hy, proxy.hz, homeLocal);
        if (!sees(localA) && !sees(homeLocal)) {
          finish(proxy);
        }
      }
    }
    for (let n = 0; n < active.length; n += 1) {
      const proxy = active[n];
      positions[n * 3] = proxy.x;
      positions[n * 3 + 1] = proxy.y;
      positions[n * 3 + 2] = proxy.z;
      shown[n] = proxy.hidden ? 0 : 1;
    }
    geometry.setDrawRange(0, active.length);
    positionAttribute.clearUpdateRanges();
    positionAttribute.addUpdateRange(0, active.length * 3);
    positionAttribute.needsUpdate = true;
    shownAttribute.clearUpdateRanges();
    shownAttribute.addUpdateRange(0, active.length);
    shownAttribute.needsUpdate = true;
    if (dirtyHigh >= 0) {
      airVisible.addUpdateRange(dirtyLow, dirtyHigh - dirtyLow + 1);
      airVisible.needsUpdate = true;
      dirtyLow = Number.POSITIVE_INFINITY;
      dirtyHigh = -1;
    }
  }
  world.onFrame((_dt, now, scaled) => update(scaled, now));

  return {
    view,
    sizeMeters,
    candidates,
    take,
    send,
    release,
    get count() {
      return active.length;
    },
    get capacity() {
      return capacity;
    },
    /** Where the borrowed particle would be drawn at home right now (world). */
    drawnHome(proxy, out) {
      return restTarget(proxy, out);
    },
    /** Run fn(now, scaledSeconds) every frame before the stand-ins move. */
    onUpdate(fn) {
      updateHooks.push(fn);
    },
    owned(owner) {
      return active.filter((proxy) => proxy.owner === owner && !proxy.home);
    },
    metersPerPixel,
    depthForPixels,
    localAt,
    toLocal,
    toWorld,
    screenOf,
    sees,
    resolve,
  };
}
