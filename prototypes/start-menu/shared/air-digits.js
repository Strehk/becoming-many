/**
 * Purpose: A loading percentage written in air particles.
 * Context: Nothing on the loading screen but the number, and the number is
 *   made of the White World's own particles. Each time it changes, the same
 *   particles flow into the new digits, left ones to the left. At 100 % the
 *   number flies into the title.
 * Responsibility: Sample digits into exactly as many places as the figure
 *   has particles, and reflow the figure when the number changes.
 * Boundary: The title gather belongs to air-title.js.
 */

import { hash } from "./air-borrow.js";
import { createFigure } from "./air-figure.js";

/** Places for a text, centred at (cx, cy) in CSS px, about count of them. */
function sampleText(text, { font, cx, cy, count }) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.font = font;
  const metrics = context.measureText(text);
  const width = Math.ceil(metrics.width) + 8;
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent);
  canvas.width = width;
  canvas.height = ascent + descent + 8;
  context.font = font;
  context.fillStyle = "#000";
  context.textBaseline = "alphabetic";
  context.fillText(text, 4, ascent + 4);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const left = cx - canvas.width / 2;
  const top = cy - canvas.height / 2;
  const at = (step) => {
    const xs = [];
    const ys = [];
    let row = 0;
    for (let y = 0; y < canvas.height; y += step * 0.866, row += 1) {
      for (let x = row % 2 ? step / 2 : 0; x < canvas.width; x += step) {
        const px = Math.round(x);
        const py = Math.round(y);
        if (data[(py * canvas.width + px) * 4 + 3] > 140) {
          xs.push(left + x);
          ys.push(top + y);
        }
      }
    }
    return { xs, ys };
  };
  let low = 1;
  let high = 40;
  let best = at(high);
  for (let round = 0; round < 16; round += 1) {
    const step = (low + high) / 2;
    best = at(step);
    if (Math.abs(best.xs.length - count) < count * 0.01) break;
    if (best.xs.length > count) low = step;
    else high = step;
  }
  // Exactly count places: drop spare ones evenly, repeat if short.
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const found = best.xs.length || 1;
  const order = Array.from({ length: found }, (_, index) => index).sort(
    (a, b) => hash(a, 61) - hash(b, 61),
  );
  for (let index = 0; index < count; index += 1) {
    const from = order[index % found];
    xs[index] = best.xs[from] ?? cx;
    ys[index] = best.ys[from] ?? cy;
  }
  return { xs, ys };
}

/**
 * A number must stand still to be read: it changes at most this often, and
 * the particles settle well before the next change. A quick load shows a few
 * numbers in big steps instead of a blur.
 */
const HOLD_SECONDS = 0.6;

export function runDigits(variant) {
  const { borrow, menu, title } = variant;
  const count = variant.phone ? 560 : 1100;
  const figure = createFigure(borrow, { owner: "loading" });
  variant.loading = figure;
  const family = getComputedStyle(document.body).fontFamily;
  let places = { xs: new Float32Array(count), ys: new Float32Array(count) };
  const shape = {
    depth: title.shape.depth,
    at(index, _t, out) {
      out.x = places.xs[index] - borrow.view.width / 2;
      out.y = places.ys[index] - borrow.view.height / 2;
    },
  };
  const placesFor = (value) => {
    const view = borrow.view;
    const size = Math.min(view.height * 0.3, view.width * 0.26, 280);
    return sampleText(`${value}%`, {
      font: `700 ${Math.round(size)}px ${family}`,
      cx: view.width / 2,
      cy: view.height * 0.47,
      count,
    });
  };
  const local = { x: 0, y: 0, z: 0 };
  const seen = { sx: 0, sy: 0, depth: 0 };
  const screenX = (proxy) => {
    borrow.toLocal(proxy.x, proxy.y, proxy.z, local);
    if (local.z > -0.5) return local.x < 0 ? -1e4 : 1e4;
    return borrow.screenOf(local, seen).sx;
  };

  /** The particles flow into the new number; left ones take the left places. */
  function reflow(next) {
    const members = figure.members;
    if (members.length === count) {
      const byMember = members
        .map((proxy, index) => [screenX(proxy), index])
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]);
      const bySlot = Array.from({ length: count }, (_, index) => index).sort(
        (a, b) => next.xs[a] - next.xs[b],
      );
      figure.reorder(byMember);
      places = {
        xs: Float32Array.from(bySlot, (slot) => next.xs[slot]),
        ys: Float32Array.from(bySlot, (slot) => next.ys[slot]),
      };
    } else {
      // Still gathering: places keep their shuffled order.
      places = next;
    }
    figure.reshape(shape, { stagger: 0.04, travel: 0.36, bend: 0.05 });
  }

  let shown = -1;
  let changedAt = -10;
  let loaded = menu.skipped;
  menu.on("loaded", () => {
    loaded = true;
  });
  let started = -1;
  borrow.onUpdate((now) => {
    if (loaded) return;
    if (started < 0) started = now;
    shape.depth = title.shape.depth;
    const value = Math.floor(menu.progress * 100);
    if (shown < 0) {
      places = placesFor(value);
      figure.reshape(shape);
      shown = value;
      changedAt = now;
    } else if (value !== shown && now - changedAt > HOLD_SECONDS) {
      reflow(placesFor(value));
      shown = value;
      changedAt = now;
    }
    // The particles gather within the first moment.
    const share = Math.min(1, (now - started) / 0.6);
    figure.fill(Math.round(count * share), {
      keepVisible: 0.3,
      travel: 1,
      centre: { x: 0, y: 0, z: -shape.depth },
    });
  });
  window.addEventListener("resize", () => {
    if (!loaded && shown >= 0) reflow(placesFor(shown));
  });
  return figure;
}
