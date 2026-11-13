/**
 * Purpose: Gather the air into "Becoming Many" and ink it into the set type.
 * Context: When loading completes, the particles of the loading figure (and
 *   more from the air around) fly into the strokes of the title, writing it
 *   from left to right. Each particle, once landed, swells into ink until the
 *   dots merge into the exact Rubik glyphs. The particles stay borrowed while
 *   the title stands: the title is made of them. Leaving the menu bursts the
 *   type back into them at once; they are thrown outward and fly home.
 * Responsibility: Size the title's particle count, assign landing places,
 *   drive the ink, burst it on leaving, and mark --title-bottom.
 * Boundary: The loading figure before the gather belongs to the variant.
 */

import { clamp01, easeInOutCubic, hash } from "./air-borrow.js";
import { createFigure } from "./air-figure.js";
import { createInk } from "./air-ink.js";

/** Keep count of the points, spread evenly over the word. */
function thin(points, count) {
  if (count >= points.count) return points;
  const order = Array.from({ length: points.count }, (_, index) => index).sort(
    (a, b) => hash(a, 21) - hash(b, 21),
  );
  const keep = order.slice(0, count);
  return {
    xs: keep.map((index) => points.xs[index]),
    ys: keep.map((index) => points.ys[index]),
    count,
    step: points.step * Math.sqrt(points.count / count),
  };
}

const wait = (seconds) =>
  new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));

/** On-screen particle size that keeps the strokes legible at this type size. */
export function titleParticlePixels(title) {
  const fontSize = Number.parseFloat(getComputedStyle(title).fontSize) || 64;
  return Math.min(4.4, Math.max(2.2, fontSize * 0.04));
}

export function createAirTitle({
  menu,
  borrow,
  title,
  maxCount = 1600,
  timing = {},
  sound,
}) {
  const root = document.documentElement;
  root.classList.add("air-title");
  const mark = () =>
    root.style.setProperty(
      "--title-bottom",
      `${Math.round(title.getBoundingClientRect().bottom)}px`,
    );
  mark();
  document.fonts.ready.then(mark);

  const ink = createInk(title);
  ink.show(false);
  const figure = createFigure(borrow, { owner: "title" });
  const travelSeconds = timing.travelSeconds ?? 2.1;
  const holdSeconds = timing.holdSeconds ?? 0.22;
  const growSeconds = timing.growSeconds ?? 0.95;
  const titleScreens = timing.screens ?? ["loading", "menu"];

  let pixels = titleParticlePixels(title);
  let points = { xs: [], ys: [], count: 0, step: 4 };
  let state = "air"; // air | gathering | set | plain
  let generation = 0;
  let timeline = null;

  /** How many particles the strokes hold at this size, without crowding. */
  function countFor() {
    const spacing = pixels * 1.22;
    return Math.round(
      Math.min(
        maxCount,
        Math.max(240, ink.area() / (0.866 * spacing * spacing)),
      ),
    );
  }

  function measure() {
    mark();
    pixels = titleParticlePixels(title);
    ink.measure();
    points = ink.sample(countFor());
  }

  const shape = {
    depth: 14,
    at(index, _t, out) {
      const i = index % Math.max(points.count, 1);
      out.x = points.xs[i] - borrow.view.width / 2;
      out.y = points.ys[i] - borrow.view.height / 2;
    },
  };

  window.addEventListener("resize", () => {
    measure();
    shape.depth = borrow.depthForPixels(pixels);
    if (state === "set") ink.full();
  });

  /** Screen x of a member now, for a left-to-right assignment. */
  const local = { x: 0, y: 0, z: 0 };
  const screen = { sx: 0, sy: 0, depth: 0 };
  const screenX = (proxy) => {
    borrow.toLocal(proxy.x, proxy.y, proxy.z, local);
    if (local.z > -0.5) return local.x < 0 ? -1e4 : 1e4 + local.x;
    return borrow.screenOf(local, screen).sx;
  };

  /**
   * Fly the loading figure's particles (and more from the air) into the
   * title. Resolves once the set type has taken over.
   */
  async function gather({ from, stagger = 1.1, travel = travelSeconds } = {}) {
    const run = ++generation;
    await document.fonts.ready;
    measure();
    shape.depth = borrow.depthForPixels(pixels);
    const adopted = from ? from.count : 0;
    // Remember how each loading particle is held, so a small loading figure
    // (a spinner) can keep turning while the air is still on its way.
    const loaderTargets = new Map();
    if (from)
      from.members.forEach((proxy, index) => {
        proxy.data.spinIndex = index;
        loaderTargets.set(proxy, proxy.target);
      });
    if (from) figure.adopt(from);
    figure.reshape(shape, { stagger: 0, travel: 0.001 });
    const wanted = points.count;
    figure.fill(wanted, {
      keepVisible: 0.3,
      travel,
      centre: { x: 0, y: 0, z: -shape.depth },
    });
    figure.trim(wanted, { duration: 2.4 });
    // A sparse world gives fewer particles: spread them over the whole word.
    points = thin(points, figure.count);
    const count = points.count;

    // Members sorted by where they are now, slots by x: left goes left.
    const byX = (indices) =>
      indices
        .map((index) => [screenX(figure.members[index]), index])
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]);
    const bySlot = Array.from(
      { length: points.count },
      (_, index) => index,
    ).sort((a, b) => points.xs[a] - points.xs[b]);
    const order = new Array(count);
    const all = Array.from({ length: count }, (_, index) => index);
    const spinner = Math.min(adopted, count);
    if (spinner > 0 && spinner < count * 0.5) {
      // A small loading figure (a spinner) spreads over the whole word
      // instead of filling the letters it happens to sit in front of; the
      // air from around takes the places in between.
      const takenRanks = new Set();
      for (const index of all.slice(0, spinner))
        figure.members[index].data.spread = true;
      byX(all.slice(0, spinner)).forEach((member, k) => {
        const rank = Math.floor(((k + 0.5) * count) / spinner);
        takenRanks.add(rank);
        order[bySlot[rank]] = member;
      });
      const freeRanks = all.filter((rank) => !takenRanks.has(rank));
      byX(all.slice(spinner)).forEach((member, k) => {
        order[bySlot[freeRanks[k]]] = member;
      });
    } else {
      const members = byX(all);
      for (let rank = 0; rank < count; rank += 1)
        order[bySlot[rank]] = members[rank];
    }
    figure.reorder(order);

    const start = borrow.view.now;
    const left = Math.min(...points.xs);
    const span = Math.max(Math.max(...points.xs) - left, 1);
    const landing = new Float32Array(count);
    figure.members.forEach((proxy, index) => {
      proxy.hidden = false;
      const along = (points.xs[index] - left) / span;
      const delay = stagger * (0.78 * along + 0.22 * hash(index, 11));
      const duration = travel * (0.82 + 0.18 * hash(index, 12));
      landing[index] = start + delay + duration;
      if (proxy.data.spread) {
        // A spinner keeps turning while the air is on its way, and opens only
        // halfway through, so each of its particles lands together with the
        // air beside it, at the same moment as before.
        proxy.data.spread = false;
        const loader = loaderTargets.get(proxy);
        const hold = (held, out, now) => {
          const keep = held.data.index;
          held.data.index = held.data.spinIndex;
          loader(held, out, now);
          held.data.index = keep;
          return out;
        };
        borrow.send(proxy, hold, { duration: 0.001 });
        const leave = delay + duration * (0.5 + 0.08 * hash(index, 18));
        window.setTimeout(() => {
          if (run !== generation) return;
          figure.fly(proxy, {
            duration: landing[index] - borrow.view.now,
            bend: 0.1,
          });
        }, leave * 1000);
        return;
      }
      figure.fly(proxy, { delay, duration, bend: 0.2 });
    });
    state = "gathering";
    timeline = {
      run,
      kind: "gather",
      landing,
      grow: new Float32Array(count),
      visible: new Uint8Array(count),
      end: Math.max(...landing) + holdSeconds + growSeconds,
    };
    // The sound follows the landings: a sample of them, panned by place.
    if (sound) {
      const now = borrow.view.now;
      const picks = [];
      const stride = Math.max(1, Math.floor(count / 56));
      for (let index = 0; index < count; index += stride)
        picks.push({
          at: landing[index] - now,
          pan: ((points.xs[index] - left) / span) * 2 - 1,
        });
      picks.sort((a, b) => a.at - b.at);
      sound.assemble(picks, timeline.end - now);
    }
    ink.show(true);
    while (run === generation && state === "gathering") await wait(0.05);
  }

  /** The ink follows each particle's landing; runs every frame. */
  function drawGather(now) {
    const { landing, grow, visible } = timeline;
    const members = figure.members;
    for (let index = 0; index < members.length; index += 1) {
      const handover = landing[index] + holdSeconds + hash(index, 13) * 0.12;
      if (now < handover) continue;
      if (!visible[index]) {
        visible[index] = 1;
        members[index].hidden = true;
      }
      grow[index] = easeInOutCubic(clamp01((now - handover) / growSeconds));
    }
    ink.draw(points, grow, visible, pixels, points.step * 1.15);
    if (now >= timeline.end + 0.15) {
      title.classList.add("is-set");
      ink.full();
      ink.show(false);
      state = "set";
      timeline = null;
    }
  }

  // Leaving: the type bursts at once into the particles it is made of, which
  // are thrown outward from the word and then fly home. No fade: the moment
  // you press, the title answers.
  const easeOutExpo = (u) => (u >= 1 ? 1 : 1 - 2 ** (-10 * u));
  const thrown = (proxy, out) => {
    out.world = true;
    out.x = proxy.data.wx;
    out.y = proxy.data.wy;
    out.z = proxy.data.wz;
    return out;
  };
  const here = { x: 0, y: 0, z: 0 };
  const seen = { sx: 0, sy: 0, depth: 0 };
  function dissolve() {
    generation += 1;
    timeline = null;
    title.classList.remove("is-set");
    ink.clear();
    ink.show(false);
    if (state === "plain" || figure.count === 0) {
      state = "air";
      return;
    }
    state = "air";
    const box = title.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    figure.members.forEach((proxy, index) => {
      proxy.hidden = false;
      borrow.toLocal(proxy.x, proxy.y, proxy.z, here);
      borrow.screenOf(here, seen);
      // Outward from the word's centre, flattened so the burst spreads wide.
      let dx = (seen.sx - cx) / (box.width / 2 || 1);
      let dy = (seen.sy - cy) / (box.height / 2 || 1);
      const angle = hash(index, 31) * Math.PI * 2;
      dx += Math.cos(angle) * 0.7;
      dy += Math.sin(angle) * 0.7;
      const norm = Math.hypot(dx, dy) || 1;
      const reach = 120 + hash(index, 32) ** 1.5 * 520;
      borrow.localAt(
        seen.sx + (dx / norm) * reach,
        seen.sy + (dy / norm) * reach * 0.8,
        seen.depth * (0.55 + hash(index, 33) * 1.1),
        here,
      );
      borrow.toWorld(here.x, here.y, here.z, here);
      proxy.data.wx = here.x;
      proxy.data.wy = here.y;
      proxy.data.wz = here.z;
      borrow.send(proxy, thrown, {
        duration: 0.7 + hash(index, 34) * 0.5,
        ease: easeOutExpo,
        bend: 0.06,
        onArrive: (arrived) =>
          borrow.release(arrived, {
            delay: hash(index, 35) * 0.4,
            duration: 2.2 + hash(index, 36) * 1.2,
            bend: 0.18,
          }),
      });
    });
    figure.forget();
  }

  borrow.onUpdate(() => {
    if (!timeline) return;
    if (timeline.run !== generation) {
      timeline = null;
      return;
    }
    drawGather(borrow.view.now);
  });

  /** Set the title without particles (?skip). */
  function setAtOnce() {
    generation += 1;
    measure();
    title.classList.add("is-set");
    state = "plain";
  }

  menu.on("screen", (screen, previous) => {
    if (!menu.ready) return;
    const wants = titleScreens.includes(screen);
    const had = titleScreens.includes(previous);
    if (wants && !had) gather({ stagger: 0.7, travel: 1.7 });
    else if (!wants && had) dissolve();
  });

  measure();
  shape.depth = borrow.depthForPixels(pixels);
  return {
    gather,
    dissolve,
    setAtOnce,
    figure,
    shape,
    get count() {
      return points.count;
    },
    get pixels() {
      return pixels;
    },
    get state() {
      return state;
    },
  };
}
