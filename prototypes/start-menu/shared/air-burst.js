/**
 * Purpose: Let a click fling particles out of the pointer.
 * Context: The pointer stays a normal pointer. A click throws a handful of
 *   particles outward from its tip in every direction, the way the swarm
 *   pointer scattered when it left the screen. They are not new: they are
 *   borrowed from air out of sight (so nobody sees them leave), flung, and
 *   fly back home out of sight again.
 * Responsibility: Borrow unseen particles, start them at the click, throw
 *   them outward, give them back.
 * Boundary: Nothing about menus; any click on the page counts.
 */

import { easeOutCubic, hash } from "./air-borrow.js";

export function createAirBurst({ borrow, menu, count }) {
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const amount = count ?? (finePointer ? 38 : 26);
  const fixed = (proxy, out) => {
    out.world = true;
    out.x = proxy.data.wx;
    out.y = proxy.data.wy;
    out.z = proxy.data.wz;
    return out;
  };
  const point = { x: 0, y: 0, z: 0 };
  // Particles leave the tip at about 7 CSS px and spread from there.
  const depth = () => borrow.depthForPixels(finePointer ? 7 : 5);
  let salt = 1;

  /** The unseen free particles nearest a point in front of the eye. */
  function unseenNear(local, wanted) {
    const c = borrow.candidates({ maxMeters: 128, maxAge: 0.25 });
    const found = [];
    for (let n = 0; n < c.count; n += 1) {
      if (c.visible[n]) continue;
      const dx = c.lx[n] - local.x;
      const dy = c.ly[n] - local.y;
      const dz = c.lz[n] - local.z;
      found.push([dx * dx + dy * dy + dz * dz, c.index[n]]);
    }
    found.sort((a, b) => a[0] - b[0]);
    return found.slice(0, wanted).map((entry) => entry[1]);
  }

  function fling(x, y) {
    const base = depth();
    borrow.localAt(x, y, base, point);
    for (const index of unseenNear(point, amount)) {
      const proxy = borrow.take(index, "burst");
      if (!proxy) continue;
      salt += 1;
      const start = base * (0.9 + hash(salt, 1) * 0.2);
      // Out of the tip: the stand-in starts right at the click.
      borrow.localAt(
        x + (hash(salt, 2) - 0.5) * 4,
        y + (hash(salt, 3) - 0.5) * 4,
        start,
        point,
      );
      borrow.toWorld(point.x, point.y, point.z, point);
      proxy.x = point.x;
      proxy.y = point.y;
      proxy.z = point.z;
      const angle = hash(salt, 4) * Math.PI * 2;
      const reach = (finePointer ? 110 : 80) + hash(salt, 5) ** 1.6 * 340;
      borrow.localAt(
        x + Math.cos(angle) * reach,
        y + Math.sin(angle) * reach,
        start * (0.75 + hash(salt, 6) * 0.9),
        point,
      );
      borrow.toWorld(point.x, point.y, point.z, point);
      proxy.data.wx = point.x;
      proxy.data.wy = point.y;
      proxy.data.wz = point.z;
      const seed = salt;
      borrow.send(proxy, fixed, {
        duration: 0.55 + 0.5 * hash(seed, 7),
        ease: easeOutCubic,
        bend: 0.12,
        onArrive: (arrived) =>
          borrow.release(arrived, {
            delay: 0.1 + hash(seed, 8) * 0.5,
            duration: 2.2 + hash(seed, 9) * 1.4,
            bend: 0.1,
          }),
      });
    }
  }

  window.addEventListener("pointerdown", (event) => {
    if (menu.screen === "launch") return;
    if (event.target instanceof Element && event.target.closest(".bm-chrome"))
      return;
    fling(event.clientX, event.clientY);
  });
  return { fling };
}
