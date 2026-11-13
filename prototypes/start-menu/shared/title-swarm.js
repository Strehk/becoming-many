/**
 * Purpose: Let particles of the White World air gather into figures and into
 *   the title, then hand over to the set type.
 * Context: The swarm draws the same squares as the air (colour, authored size,
 *   desktop scale) so a particle that leaves the drift cannot be told apart
 *   from the rest of it. It hangs on the camera, so a formed figure stays where
 *   the type will stand while the visitor keeps gliding and turning.
 * Responsibility: Own one Points cloud, its per-particle springs, the drift of
 *   free particles, formations given in screen pixels, and sampling an
 *   element's glyphs into a formation.
 * Boundary: What to form, and when, belongs to the variant.
 */

import {
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  Points,
  PointsMaterial,
} from "three";
import { AIR_PARTICLE_COLOR, airParticleSize } from "./air-world.js";

const NEAR_METERS = 1.6;
const FAR_METERS = 34;
const FADE_NEAR_METERS = 9;
/** The air's own wobble amplitudes from the White World recipe. */
const WOBBLE_X = 0.12;
const WOBBLE_Y = 0.24;

function random(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * options.capacity: most particles at once.
 * options.pixelSize: on-screen size a formed particle should have, in CSS px;
 *   it sets the depth formations hang at.
 */
export function createTitleSwarm(world, options = {}) {
  const capacity = options.capacity ?? 4000;
  const camera = world.camera;
  const size = airParticleSize();
  const rand = random(options.seed ?? 11);

  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 4);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  const material = new PointsMaterial({
    color: AIR_PARTICLE_COLOR,
    size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  camera.add(points);

  // Per particle: velocity, free drift slot, spring rate, rank, wobble phase.
  const velocity = new Float32Array(capacity * 3);
  const free = new Float32Array(capacity * 3);
  const rate = new Float32Array(capacity);
  const rank = new Float32Array(capacity);
  const phase = new Float32Array(capacity);
  const swirl = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  const attachAt = new Float32Array(capacity);
  // A flight into a formation: where it began, when, and which formation.
  const flightFrom = new Float32Array(capacity * 3);
  const flightStart = new Float32Array(capacity);
  const flightSerial = new Uint32Array(capacity);
  const travelShare = new Float32Array(capacity);

  const view = { width: 1, height: 1, halfHeight: 1, halfWidth: 1 };
  function measure() {
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.halfHeight = Math.tan(MathUtils.degToRad(camera.fov / 2));
    view.halfWidth = view.halfHeight * (view.width / view.height);
  }
  measure();

  const state = {
    time: 0,
    formation: null,
    formedAt: 0,
    opacity: 1,
    targetOpacity: 1,
    opacityRate: 1,
    pixelSize: options.pixelSize ?? 4,
    stiffness: 3.2,
    travel: 1.6,
    serial: 0,
  };

  /** Depth at which one particle is pixelSize CSS pixels wide. */
  const formationDepth = () => (size * (view.height / 2)) / state.pixelSize;

  function spawnFree(index, anywhere) {
    const depth = anywhere
      ? NEAR_METERS + rand() * (FAR_METERS - NEAR_METERS)
      : FAR_METERS * (0.8 + rand() * 0.2);
    const spread = 1.25;
    free[index * 3] = (rand() * 2 - 1) * view.halfWidth * depth * spread;
    free[index * 3 + 1] = (rand() * 2 - 1) * view.halfHeight * depth * spread;
    free[index * 3 + 2] = -depth;
  }

  for (let index = 0; index < capacity; index += 1) {
    spawnFree(index, true);
    positions[index * 3] = free[index * 3];
    positions[index * 3 + 1] = free[index * 3 + 1];
    positions[index * 3 + 2] = free[index * 3 + 2];
    rate[index] = 0.75 + rand() * 0.6;
    rank[index] = rand();
    phase[index] = rand() * Math.PI * 2;
    swirl[index] = (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.8);
    travelShare[index] = 0.75 + rand() * 0.25;
    alpha[index] = 1;
    colors[index * 4] = 1;
    colors[index * 4 + 1] = 1;
    colors[index * 4 + 2] = 1;
    colors[index * 4 + 3] = 1;
  }

  const target = { x: 0, y: 0, a: 1, depth: 0 };

  function update(dt) {
    state.time += dt;
    const t = state.time;
    const speed = world.speed;
    const formation = state.formation;
    const depth = formationDepth();

    state.opacity +=
      Math.sign(state.targetOpacity - state.opacity) *
      Math.min(
        Math.abs(state.targetOpacity - state.opacity),
        dt * state.opacityRate,
      );
    material.opacity = state.opacity;
    points.visible = state.opacity > 0.001;

    for (let index = 0; index < capacity; index += 1) {
      const i3 = index * 3;
      // The free drift: the visitor glides forward, so the air comes closer.
      free[i3 + 2] += speed * dt;
      const wobbleX = Math.sin(t * 0.7 + phase[index]) * WOBBLE_X;
      const wobbleY = Math.sin(t * 0.5 + phase[index] * 1.3) * WOBBLE_Y;

      let ax;
      let ay;
      let az;
      let wanted = 1;
      let following = false;
      if (formation && index < formation.count && t >= attachAt[index]) {
        target.a = 1;
        target.depth = 0;
        // A formation may leave a particle in the drift by returning false.
        following = formation.at(index, t, target) !== false;
      }
      if (following) {
        const d = depth + target.depth;
        ax = (target.x * (view.halfWidth * d)) / (view.width / 2);
        ay = (-target.y * (view.halfHeight * d)) / (view.height / 2);
        az = -d;
        wanted = target.a;
      } else {
        ax = free[i3] + wobbleX;
        ay = free[i3 + 1] + wobbleY;
        az = free[i3 + 2];
        flightSerial[index] = 0;
      }

      const dx = ax - positions[i3];
      const dy = ay - positions[i3 + 1];
      const dz = az - positions[i3 + 2];
      if (following) {
        // Into a formation: an eased flight on a curve that lands exactly
        // when it says it will, then holds its point (which may move).
        if (flightSerial[index] !== state.serial) {
          flightSerial[index] = state.serial;
          flightStart[index] = t;
          flightFrom[i3] = positions[i3];
          flightFrom[i3 + 1] = positions[i3 + 1];
          flightFrom[i3 + 2] = positions[i3 + 2];
        }
        const u = Math.min(
          1,
          (t - flightStart[index]) / (state.travel * travelShare[index]),
        );
        const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
        const fx = ax - flightFrom[i3];
        const fy = ay - flightFrom[i3 + 1];
        const bend = Math.sin(Math.PI * u) * swirl[index] * 0.3;
        const nx = flightFrom[i3] + fx * e - fy * bend;
        const ny = flightFrom[i3 + 1] + fy * e + fx * bend;
        const nz = flightFrom[i3 + 2] + (az - flightFrom[i3 + 2]) * e;
        if (dt > 0) {
          velocity[i3] = (nx - positions[i3]) / dt;
          velocity[i3 + 1] = (ny - positions[i3 + 1]) / dt;
          velocity[i3 + 2] = (nz - positions[i3 + 2]) / dt;
        }
        positions[i3] = nx;
        positions[i3 + 1] = ny;
        positions[i3 + 2] = nz;
      } else {
        // Back to the drift: a critically damped spring with a sideways swirl.
        const k = state.stiffness * rate[index];
        const turn = swirl[index] * k * k * 0.35;
        velocity[i3] += (dx * k * k - velocity[i3] * 2 * k - dy * turn) * dt;
        velocity[i3 + 1] +=
          (dy * k * k - velocity[i3 + 1] * 2 * k + dx * turn) * dt;
        velocity[i3 + 2] += (dz * k * k - velocity[i3 + 2] * 2 * k) * dt;
        positions[i3] += velocity[i3] * dt;
        positions[i3 + 1] += velocity[i3 + 1] * dt;
        positions[i3 + 2] += velocity[i3 + 2] * dt;
      }

      // Free particles that passed the visitor return far ahead, unseen.
      if (!following && free[i3 + 2] > -NEAR_METERS) {
        const settled = Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 0.6;
        if (settled) {
          spawnFree(index, false);
          positions[i3] = free[i3];
          positions[i3 + 1] = free[i3 + 1];
          positions[i3 + 2] = free[i3 + 2];
          velocity[i3] = 0;
          velocity[i3 + 1] = 0;
          velocity[i3 + 2] = 0;
          alpha[index] = 0;
        } else if (free[i3 + 2] > 4) {
          spawnFree(index, false);
        }
      }
      // Free particles only show in the middle distance, where they are as
      // small as the air around them; close by, the real air takes over.
      if (!following) {
        const depthNow = -positions[i3 + 2];
        const near = (depthNow - FADE_NEAR_METERS) / 4;
        const far = (FAR_METERS - depthNow) / 6;
        wanted = Math.min(1, Math.max(0, Math.min(near, far)));
      } else {
        const close = (-positions[i3 + 2] - 3) / 5;
        wanted *= Math.min(1, Math.max(0, close));
      }
      alpha[index] += (wanted - alpha[index]) * Math.min(1, dt * 6);
      colors[index * 4 + 3] = alpha[index];
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
  world.onFrame((dt) => update(Math.min(dt, 0.05)));

  window.addEventListener("resize", () => {
    measure();
    if (state.formation?.onResize) state.formation.onResize();
  });

  return {
    points,
    get view() {
      return view;
    },
    get pixelSize() {
      return state.pixelSize;
    },
    set pixelSize(value) {
      state.pixelSize = value;
    },
    get formation() {
      return state.formation;
    },
    /**
     * Gather the first formation.count particles into it. formation.at(i, t,
     * out) writes out.x / out.y in CSS px from the screen centre (and out.a,
     * 0..1). stagger spreads the departures over that many seconds.
     */
    form(formation, { stagger = 1, travel = 1.6, order = "random" } = {}) {
      state.formation = formation;
      state.formedAt = state.time;
      state.travel = travel;
      state.serial += 1;
      for (let index = 0; index < capacity; index += 1) {
        const delay =
          order === "index"
            ? (index / Math.max(1, formation.count)) * stagger
            : order === "now"
              ? 0
              : rank[index] * stagger;
        attachAt[index] = state.time + delay;
      }
    },
    /** Let every particle go back to the drift. */
    release({ stiffness = 1.6 } = {}) {
      state.formation = null;
      state.stiffness = stiffness;
    },
    /** Fade the whole swarm, e.g. while the set type takes over. */
    fade(opacity, seconds = 0.8) {
      state.targetOpacity = opacity;
      state.opacityRate = 1 / Math.max(seconds, 0.001);
    },
    /** Put attached particles on their targets at once (for ?skip). */
    snap() {
      update(0);
      const f = state.formation;
      if (!f) return;
      const depth = formationDepth();
      for (let index = 0; index < Math.min(f.count, capacity); index += 1) {
        target.a = 1;
        target.depth = 0;
        f.at(index, state.time, target);
        const d = depth + target.depth;
        positions[index * 3] =
          (target.x * (view.halfWidth * d)) / (view.width / 2);
        positions[index * 3 + 1] =
          (-target.y * (view.halfHeight * d)) / (view.height / 2);
        positions[index * 3 + 2] = -d;
        attachAt[index] = state.time;
        // Already landed: the flight is long over.
        flightSerial[index] = state.serial;
        flightStart[index] = -1e6;
        flightFrom[index * 3] = positions[index * 3];
        flightFrom[index * 3 + 1] = positions[index * 3 + 1];
        flightFrom[index * 3 + 2] = positions[index * 3 + 2];
      }
      geometry.attributes.position.needsUpdate = true;
    },
    capacity,
  };
}

/**
 * Sample an element's glyphs into a static formation, so the particles land
 * exactly on the strokes the browser will draw. Characters are drawn one by
 * one at their own layout boxes, which carries letter-spacing, transforms and
 * line breaks over without re-implementing them.
 */
export function sampleTextFormation(element, { step = 5, seed = 3 } = {}) {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const pad = 8;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(box.width) + pad * 2;
  canvas.height = Math.ceil(box.height) + pad * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fillStyle = "#000";
  context.textBaseline = "alphabetic";
  const ascent = context.measureText("Mg").fontBoundingBoxAscent;
  const upper = style.textTransform === "uppercase";
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    for (let index = 0; index < text.length; index += 1) {
      const char = upper ? text[index].toUpperCase() : text[index];
      if (!char.trim()) continue;
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      context.fillText(
        char,
        rect.left - box.left + pad,
        rect.top - box.top + pad + ascent,
      );
    }
  }
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const rand = random(seed);
  const found = [];
  const rowHeight = step * 0.866;
  let row = 0;
  for (let y = 0; y < canvas.height; y += rowHeight, row += 1) {
    const shift = row % 2 ? step / 2 : 0;
    for (let x = shift; x < canvas.width; x += step) {
      const sx = Math.round(x + (rand() - 0.5) * step * 0.25);
      const sy = Math.round(y + (rand() - 0.5) * step * 0.25);
      if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height)
        continue;
      if (data[(sy * canvas.width + sx) * 4 + 3] > 140) {
        found.push(
          box.left + sx - pad - window.innerWidth / 2,
          box.top + sy - pad - window.innerHeight / 2,
        );
      }
    }
  }
  // Shuffle, so any prefix of the list covers the whole word evenly.
  const count = found.length / 2;
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index -= 1) {
    const other = Math.floor(rand() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  order.forEach((from, to) => {
    xs[to] = found[from * 2];
    ys[to] = found[from * 2 + 1];
  });
  return {
    count,
    at(index, _t, out) {
      out.x = xs[index];
      out.y = ys[index];
    },
  };
}
