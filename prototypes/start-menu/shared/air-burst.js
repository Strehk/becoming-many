/**
 * Purpose: Let a click scatter the air around it.
 * Context: The pointer stays a normal pointer. Where the visitor clicks, the
 *   air particles around that spot are blown outward in every direction, the
 *   way a released swarm scatters, and drift back home afterwards.
 * Responsibility: Borrow the particles near a click, throw them outward at
 *   their own depth, then give them back.
 * Boundary: Nothing about menus; any click on the page counts.
 */

import { easeOutCubic, hash } from "./air-borrow.js";

export function createAirBurst({ borrow, menu, radius = 200 }) {
  const fixed = (proxy, out) => {
    out.world = true;
    out.x = proxy.data.wx;
    out.y = proxy.data.wy;
    out.z = proxy.data.wz;
    return out;
  };
  const home = { x: 0, y: 0, z: 0 };
  const seen = { sx: 0, sy: 0, depth: 0 };
  const point = { x: 0, y: 0, z: 0 };

  function burst(x, y) {
    const c = borrow.candidates({ maxMeters: 128, maxAge: 0.05 });
    const reach = radius * radius;
    let salt = Math.floor(borrow.view.now * 1000);
    for (let n = 0; n < c.count; n += 1) {
      if (!c.visible[n]) continue;
      const dx = c.sx[n] - x;
      const dy = c.sy[n] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach) continue;
      const proxy = borrow.take(c.index[n], "burst");
      if (!proxy) continue;
      salt += 1;
      const distance = Math.sqrt(d2);
      // Right at the click there is no outward: pick a direction.
      let ux = dx / (distance || 1);
      let uy = dy / (distance || 1);
      if (distance < 6) {
        const angle = hash(salt, 1) * Math.PI * 2;
        ux = Math.cos(angle);
        uy = Math.sin(angle);
      }
      const strength = (1 - distance / radius) ** 0.8;
      const throwPixels = 40 + 230 * strength * (0.7 + 0.6 * hash(salt, 2));
      borrow.drawnHome(proxy, home);
      borrow.toLocal(home.x, home.y, home.z, home);
      borrow.screenOf(home, seen);
      // The puff also comes toward the eye, so even far dust reads as it flies.
      const depth = Math.max(
        6,
        seen.depth * (1 - 0.6 * strength * (0.6 + 0.4 * hash(salt, 3))),
      );
      borrow.localAt(
        seen.sx + ux * throwPixels,
        seen.sy + uy * throwPixels,
        depth,
        point,
      );
      borrow.toWorld(point.x, point.y, point.z, point);
      proxy.data.wx = point.x;
      proxy.data.wy = point.y;
      proxy.data.wz = point.z;
      borrow.send(proxy, fixed, {
        duration: 0.5 + 0.35 * hash(salt, 4),
        ease: easeOutCubic,
        bend: 0.08,
        onArrive: (arrived) =>
          borrow.release(arrived, {
            delay: 0.2 + hash(salt, 5) * 0.6,
            duration: 2 + hash(salt, 6) * 1.4,
            bend: 0.1,
          }),
      });
    }
  }

  window.addEventListener("pointerdown", (event) => {
    if (menu.screen === "launch") return;
    burst(event.clientX, event.clientY);
  });
  return { burst };
}
