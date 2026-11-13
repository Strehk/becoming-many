/**
 * Purpose: Gather the air into "Becoming Many" and ink it into the set type.
 * Context: When loading completes, the particles of the loading figure (and
 *   more from the air around) fly into the strokes of the title, writing it
 *   from left to right. Each particle, once landed, swells into ink until the
 *   dots merge into the exact Rubik glyphs. The particles stay borrowed while
 *   the title stands: the title is made of them. Leaving the menu reverses it,
 *   and they fly home.
 * Responsibility: Size the title's particle count, assign landing places,
 *   drive the ink, dissolve, and mark --title-bottom for the layout.
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
  const shrinkSeconds = timing.shrinkSeconds ?? 0.55;
  const titleScreens = timing.screens ?? ["loading", "menu"];

  let pixels = titleParticlePixels(title);
  let points = { xs: [], ys: [], count: 0, step: 4 };
  let state = "air"; // air | gathering | set | plain | dissolving
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
    const byMember = figure.members
      .map((proxy, index) => [screenX(proxy), index])
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1]);
    const bySlot = Array.from(
      { length: points.count },
      (_, index) => index,
    ).sort((a, b) => points.xs[a] - points.xs[b]);
    const order = new Array(count);
    for (let rank = 0; rank < count; rank += 1)
      order[bySlot[rank]] = byMember[rank];
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

  /** The type shrinks back into particles, which fly home. */
  function dissolve() {
    const run = ++generation;
    if (state === "plain") {
      title.classList.remove("is-set");
      state = "air";
      return;
    }
    if (state === "gathering" || state === "dissolving") {
      // Interrupted: every particle shows again and goes home.
      for (const proxy of figure.members) proxy.hidden = false;
      figure.release({ duration: 2.2 });
      ink.clear();
      ink.show(false);
      title.classList.remove("is-set");
      state = "air";
      timeline = null;
      return;
    }
    if (state !== "set") return;
    state = "dissolving";
    title.classList.remove("is-set");
    ink.show(true);
    const count = figure.count;
    const left = Math.min(...points.xs);
    const span = Math.max(Math.max(...points.xs) - left, 1);
    const start = borrow.view.now;
    const begin = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const along = (points.xs[index] - left) / span;
      begin[index] = start + 0.35 * along + 0.1 * hash(index, 14);
    }
    timeline = {
      run,
      kind: "dissolve",
      begin,
      grow: new Float32Array(count).fill(1),
      visible: new Uint8Array(count).fill(1),
      end: Math.max(...begin) + shrinkSeconds,
    };
  }

  function drawDissolve(now) {
    const { begin, grow, visible } = timeline;
    const members = figure.members;
    for (let index = 0; index < members.length; index += 1) {
      if (!visible[index]) continue;
      const u = clamp01((now - begin[index]) / shrinkSeconds);
      grow[index] = 1 - easeInOutCubic(u);
      if (u >= 1) {
        visible[index] = 0;
        const proxy = members[index];
        proxy.hidden = false;
      }
    }
    ink.draw(points, grow, visible, pixels, points.step * 1.15);
    if (now >= timeline.end) {
      // Back to particles: they leave the strokes and fly home.
      ink.clear();
      ink.show(false);
      figure.members.forEach((proxy, index) => {
        proxy.hidden = false;
        borrow.release(proxy, {
          delay: 0.05 + hash(index, 15) * 0.5,
          duration: 2.2 + hash(index, 16) * 1.2,
          bend: 0.22,
        });
      });
      figure.forget();
      state = "air";
      timeline = null;
    }
  }

  borrow.onUpdate(() => {
    if (!timeline) return;
    if (timeline.run !== generation) {
      timeline = null;
      return;
    }
    const now = borrow.view.now;
    if (timeline.kind === "gather") drawGather(now);
    else drawDissolve(now);
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
