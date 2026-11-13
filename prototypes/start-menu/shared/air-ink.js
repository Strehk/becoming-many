/**
 * Purpose: Morph landed particles into the set title, and the title back.
 * Context: The particles that form "Becoming Many" are squares of the air's
 *   own colour. At the handover each one is replaced, at the same spot and
 *   size, by a dot on a canvas; the dots then swell until they merge into the
 *   exact strokes of the Rubik type, and the type takes over. Dot by dot, in
 *   the order the particles landed, so the word inks itself.
 * Responsibility: Sample the title's glyphs, render its exact mask, and draw
 *   the swelling (or shrinking) dots clipped to that mask.
 * Boundary: Which particle lands where, and when, belongs to the title.
 */

const INK = "#202126";

/** Draw the element's text exactly where the browser sets it. */
function drawTitle(context, element, box, pad, scale) {
  const style = getComputedStyle(element);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fillStyle = INK;
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
}

export function createInk(element) {
  const canvas = document.createElement("canvas");
  canvas.className = "bm-ink";
  canvas.setAttribute("aria-hidden", "true");
  element.after(canvas);
  const context = canvas.getContext("2d");
  const mask = document.createElement("canvas");
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  const pad = 12;
  let box = element.getBoundingClientRect();
  let scale = 1;
  let ink = null;

  /** Re-render the mask at the title's current place and size. */
  function measure() {
    box = element.getBoundingClientRect();
    scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.ceil(box.width + pad * 2);
    const height = Math.ceil(box.height + pad * 2);
    for (const target of [canvas, mask]) {
      target.width = Math.ceil(width * scale);
      target.height = Math.ceil(height * scale);
    }
    canvas.style.left = `${box.left - pad}px`;
    canvas.style.top = `${box.top - pad}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    maskContext.clearRect(0, 0, mask.width, mask.height);
    drawTitle(maskContext, element, box, pad, scale);
    ink = maskContext.getImageData(0, 0, mask.width, mask.height).data;
  }

  const inside = (x, y) => {
    const px = Math.round((x - box.left + pad) * scale);
    const py = Math.round((y - box.top + pad) * scale);
    if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) return false;
    return ink[(py * mask.width + px) * 4 + 3] > 150;
  };

  /** Points on a jittered hex grid inside the strokes, in screen CSS px. */
  function sampleAt(step, seed = 3) {
    let state = seed;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
    const xs = [];
    const ys = [];
    const rowHeight = step * 0.866;
    let row = 0;
    for (let y = box.top - 2; y < box.bottom + 2; y += rowHeight, row += 1) {
      const shift = row % 2 ? step / 2 : 0;
      for (let x = box.left - 2 + shift; x < box.right + 2; x += step) {
        const sx = x + (random() - 0.5) * step * 0.2;
        const sy = y + (random() - 0.5) * step * 0.2;
        if (inside(sx, sy)) {
          xs.push(sx);
          ys.push(sy);
        }
      }
    }
    return { xs, ys, count: xs.length, step };
  }

  /** The grid step that yields about this many points. */
  function sample(count) {
    let low = 1;
    let high = 40;
    let best = sampleAt(high);
    for (let round = 0; round < 14; round += 1) {
      const step = (low + high) / 2;
      const found = sampleAt(step);
      best = found;
      if (Math.abs(found.count - count) < count * 0.02) break;
      if (found.count > count) low = step;
      else high = step;
    }
    return best;
  }

  /** Ink coverage of the strokes in CSS px², for sizing the particle count. */
  function area() {
    let filled = 0;
    for (let index = 3; index < ink.length; index += 4)
      if (ink[index] > 150) filled += 1;
    return filled / (scale * scale);
  }

  /**
   * Draw dots: for each i, grow[i] in 0..1 (0 = a particle-sized square,
   * 1 = fully merged); visible[i] says whether the dot is on the canvas yet.
   */
  function draw(points, grow, visible, particlePixels, reach) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const ox = box.left - pad;
    const oy = box.top - pad;
    context.fillStyle = INK;
    // Swelling dots, clipped to the strokes.
    context.beginPath();
    let any = false;
    for (let i = 0; i < points.count; i += 1) {
      if (!visible[i] || grow[i] <= 0) continue;
      const radius =
        particlePixels * 0.5 + (reach - particlePixels * 0.5) * grow[i];
      const x = points.xs[i] - ox;
      const y = points.ys[i] - oy;
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
      any = true;
    }
    if (any) {
      context.fill();
      context.globalCompositeOperation = "destination-in";
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(mask, 0, 0);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.globalCompositeOperation = "source-over";
    }
    // The particle squares themselves, shrinking as their dot swells.
    context.beginPath();
    for (let i = 0; i < points.count; i += 1) {
      if (!visible[i]) continue;
      const side = particlePixels * (1 - grow[i]);
      if (side <= 0.05) continue;
      context.rect(
        points.xs[i] - ox - side / 2,
        points.ys[i] - oy - side / 2,
        side,
        side,
      );
    }
    context.fill();
  }

  function full() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(mask, 0, 0);
  }

  function clear() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  measure();
  return {
    canvas,
    measure,
    sample,
    area,
    draw,
    full,
    clear,
    show(on) {
      canvas.style.visibility = on ? "visible" : "hidden";
    },
  };
}
