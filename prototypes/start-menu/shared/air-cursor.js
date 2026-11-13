/**
 * Purpose: Replace the pointer with something the air does.
 * Context: In a world that only has particles, the pointer should be one more
 *   arrangement of them. Three answers, one per variant, all made of borrowed
 *   air particles that fly home afterwards:
 *   - swarm: the pointer is a small swarm that catches particles out of the
 *     space it sweeps through, grows, and sheds them when it rests;
 *   - wake: a ring of particles marks the pointer and the dust parts around
 *     it like water around a hand; a click sends a sonar pulse through it;
 *   - trail: a dense tip draws a trace of particles that stays rooted in the
 *     space for a moment, and a hovered entry is underlined with air.
 * Responsibility: Follow the pointer (or a finger while it touches), recruit
 *   and release particles for the chosen behaviour.
 * Boundary: Hover, click and screen state come from the menu flow.
 */

import { clamp01, easeOutCubic, hash } from "./air-borrow.js";

const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

const TAU = Math.PI * 2;

export function createAirCursor({ borrow, menu, mode = "swarm" }) {
  const root = document.documentElement;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer) root.classList.add("air-cursor");

  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    seen: false,
    down: false,
    touch: !finePointer,
    lastX: 0,
    lastY: 0,
    speed: 0,
    stillFor: 0,
  };
  const cur = { x: pointer.x, y: pointer.y };
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.touch = event.pointerType === "touch";
    if (!pointer.touch) pointer.seen = true;
  });
  window.addEventListener("pointerdown", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.touch = event.pointerType === "touch";
    pointer.down = true;
    if (!pointer.touch) pointer.seen = true;
    else {
      cur.x = pointer.x;
      cur.y = pointer.y;
    }
    behaviour.press?.();
  });
  const up = () => {
    pointer.down = false;
  };
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  document.documentElement.addEventListener("pointerleave", () => {
    if (!pointer.touch) pointer.seen = false;
  });

  /** Mouse: whenever it is over the page. Touch: while a finger is down. */
  const present = () =>
    menu.screen !== "launch" && (pointer.touch ? pointer.down : pointer.seen);

  // Depth at which cursor particles draw about 5 CSS px wide (3 on phones).
  const depth = () => borrow.depthForPixels(finePointer ? 5 : 3.4);

  /** The free particles nearest a screen point, visible first. */
  function nearest(sx, sy, count, radius = 1e9) {
    const c = borrow.candidates({ maxMeters: 128, maxAge: 0.12 });
    const found = [];
    const r2 = radius * radius;
    for (let n = 0; n < c.count; n += 1) {
      if (!c.visible[n]) continue;
      const dx = c.sx[n] - sx;
      const dy = c.sy[n] - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) found.push([d2, c.index[n]]);
    }
    found.sort((a, b) => a[0] - b[0]);
    const picked = found.slice(0, count).map((entry) => entry[1]);
    if (picked.length < count && radius > 1e8) {
      // Not enough in view: take the nearest in space around the eye.
      const local = borrow.localAt(sx, sy, depth(), {});
      const near = [];
      for (let n = 0; n < c.count; n += 1) {
        if (c.visible[n]) continue;
        const dx = c.lx[n] - local.x;
        const dy = c.ly[n] - local.y;
        const dz = c.lz[n] - local.z;
        near.push([dx * dx + dy * dy + dz * dz, c.index[n]]);
      }
      near.sort((a, b) => a[0] - b[0]);
      for (const entry of near) {
        if (picked.length >= count) break;
        picked.push(entry[1]);
      }
    }
    return picked;
  }

  let hovered = null;
  menu.on("hover", (key) => {
    hovered = key;
    behaviour.hover?.(key);
  });
  menu.on("select", () => behaviour.select?.());

  let last = 0;
  const behaviours = { swarm, wake, trail };
  const behaviour = (behaviours[mode] ?? swarm)();

  borrow.onUpdate((now) => {
    const dt = Math.min(now - (last || now), 0.05);
    last = now;
    const moved = Math.hypot(
      pointer.x - pointer.lastX,
      pointer.y - pointer.lastY,
    );
    pointer.speed = approach(pointer.speed, dt > 0 ? moved / dt : 0, 10, dt);
    pointer.stillFor = moved > 0.5 ? 0 : pointer.stillFor + dt;
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
    behaviour.update(now, dt, present());
  });

  // 1. Swarm: catches particles while moving, sheds them at rest.
  function swarm() {
    const BASE = 18;
    const MAX = finePointer ? 170 : 110;
    const members = [];
    let shedAt = 0;
    let pulse = 0;
    const target = (proxy, out, now) => {
      const d = proxy.data;
      // Over an entry the swarm opens into a ring, so the word stays legible.
      d.open = approach(d.open ?? 0, hovered ? 1 : 0, 6, 1 / 60);
      const grown = 0.75 + 0.35 * Math.sqrt(members.length / BASE);
      const angle = d.phase + now * d.spin * (1 + d.open * 0.8);
      const loose = d.r * grown;
      const ringed = 22 + (d.r % 5) * 1.2;
      const r = (loose + (ringed - loose) * d.open) * (1 + pulse * 1.6);
      const sx = d.cx + Math.cos(angle) * r;
      const sy =
        d.cy + Math.sin(angle) * r * 0.86 + Math.sin(now * 1.3 + d.phase) * 1.5;
      return borrow.localAt(sx, sy, depth() + d.z, out);
    };
    const join = (index, core) => {
      const proxy = borrow.take(index, "cursor");
      if (!proxy) return;
      const d = proxy.data;
      d.core = core;
      d.cx = cur.x;
      d.cy = cur.y;
      d.follow = core ? 26 : 5 + hash(proxy.air, 1) * 9;
      d.r = core
        ? 1.5 + hash(proxy.air, 2) * 2
        : 5 + Math.sqrt(hash(proxy.air, 3)) * 22;
      d.phase = hash(proxy.air, 4) * TAU;
      d.spin =
        (0.6 + hash(proxy.air, 5) * 1.4) * (hash(proxy.air, 6) > 0.5 ? 1 : -1);
      d.z = (hash(proxy.air, 7) - 0.5) * 3;
      members.push(proxy);
      borrow.send(proxy, target, {
        duration: core ? 0.5 : 0.7 + hash(proxy.air, 8) * 0.6,
        ease: easeOutCubic,
        bend: 0.25,
      });
    };
    const leave = (proxy, bend = 0.2) => {
      borrow.release(proxy, {
        duration: 1.8 + hash(proxy.air, 9) * 1.2,
        bend,
      });
    };
    return {
      update(now, dt, on) {
        cur.x = approach(cur.x, pointer.x, 30, dt);
        cur.y = approach(cur.y, pointer.y, 30, dt);
        pulse = approach(pulse, 0, 5, dt);
        if (!on) {
          while (members.length) leave(members.pop());
          return;
        }
        for (const proxy of members) {
          proxy.data.cx = approach(proxy.data.cx, cur.x, proxy.data.follow, dt);
          proxy.data.cy = approach(proxy.data.cy, cur.y, proxy.data.follow, dt);
        }
        if (members.length < BASE) {
          for (const index of nearest(cur.x, cur.y, BASE - members.length))
            join(index, members.length < 5);
        }
        // Moving sweeps particles out of the space it passes.
        if (pointer.speed > 60 && members.length < MAX) {
          const reach = 30 + Math.min(members.length, 120) * 0.35;
          for (const index of nearest(
            cur.x,
            cur.y,
            pointer.speed > 600 ? 3 : 1,
            reach,
          ))
            join(index, false);
        }
        // Resting, it sheds what it caught, oldest first.
        if (pointer.stillFor > 1.4 && members.length > BASE && now > shedAt) {
          const index = members.findIndex((proxy) => !proxy.data.core);
          if (index >= 0) leave(members.splice(index, 1)[0]);
          shedAt = now + 0.09;
        }
      },
      select() {
        // A click scatters what was caught, back into the space.
        pulse = 1;
        for (let n = members.length - 1; n >= 0; n -= 1)
          if (!members[n].data.core && n >= BASE)
            leave(members.splice(n, 1)[0], 0.6);
      },
    };
  }

  // 2. Wake: a ring for the pointer; the dust parts around it.
  function wake() {
    const RING = 14;
    const RADIUS = finePointer ? 130 : 110;
    const ring = [];
    const parted = new Map();
    const pulses = [];
    let ringSize = 10;
    const ringTarget = (proxy, out, now) => {
      const d = proxy.data;
      const angle = (d.slot / RING) * TAU + now * (hovered ? 1.4 : 0.45);
      const r = ringSize + Math.sin(now * 2 + d.slot) * 0.6;
      return borrow.localAt(
        cur.x + Math.cos(angle) * r,
        cur.y + Math.sin(angle) * r,
        depth(),
        out,
      );
    };
    const homeLocal = { x: 0, y: 0, z: 0 };
    const homeScreen = { sx: 0, sy: 0, depth: 0 };
    /** Where the particle floats at home, as seen now. */
    const seeHome = (proxy) => {
      borrow.drawnHome(proxy, homeLocal);
      borrow.toLocal(homeLocal.x, homeLocal.y, homeLocal.z, homeLocal);
      return borrow.screenOf(homeLocal, homeScreen);
    };
    // The particle's own home, pushed outward from the pointer.
    const partTarget = (proxy, out) => {
      const d = proxy.data;
      const home = seeHome(proxy);
      return borrow.localAt(
        home.sx + d.dirX * d.push,
        home.sy + d.dirY * d.push,
        home.depth,
        out,
      );
    };
    return {
      update(_now, dt, on) {
        cur.x = approach(cur.x, pointer.x, 40, dt);
        cur.y = approach(cur.y, pointer.y, 40, dt);
        ringSize = approach(ringSize, hovered ? 17 : 10, 8, dt);
        if (!on) {
          while (ring.length)
            borrow.release(ring.pop(), { duration: 1.6, bend: 0.2 });
        } else if (ring.length < RING) {
          for (const index of nearest(cur.x, cur.y, RING - ring.length)) {
            const proxy = borrow.take(index, "cursor");
            if (!proxy) continue;
            proxy.data.slot = ring.length;
            ring.push(proxy);
            borrow.send(proxy, ringTarget, {
              duration: 0.6 + hash(index, 1) * 0.4,
              ease: easeOutCubic,
              bend: 0.2,
            });
          }
        }
        // Pulses travel outward from a click.
        for (let n = pulses.length - 1; n >= 0; n -= 1) {
          pulses[n].age += dt;
          if (pulses[n].age > 1.3) pulses.splice(n, 1);
        }
        const reach = RADIUS + 24;
        const c = borrow.candidates({ maxMeters: 128, maxAge: 0.15 });
        if (on || pulses.length) {
          for (let n = 0; n < c.count; n += 1) {
            if (!c.visible[n]) continue;
            const distance = Math.hypot(c.sx[n] - cur.x, c.sy[n] - cur.y);
            let wanted = on && distance < reach;
            for (const pulse of pulses) {
              const front = pulse.age * 760;
              if (
                Math.abs(
                  Math.hypot(c.sx[n] - pulse.x, c.sy[n] - pulse.y) - front,
                ) < 70
              )
                wanted = true;
            }
            if (!wanted || parted.has(c.index[n])) continue;
            const proxy = borrow.take(c.index[n], "wake");
            if (!proxy) continue;
            proxy.data.push = 0;
            proxy.data.dirX = 0;
            proxy.data.dirY = 0;
            parted.set(c.index[n], proxy);
            borrow.send(proxy, partTarget, { duration: 0.001 });
          }
        }
        for (const [index, proxy] of parted) {
          const d = proxy.data;
          const home = seeHome(proxy);
          const dx = home.sx - cur.x;
          const dy = home.sy - cur.y;
          const distance = Math.hypot(dx, dy) || 1;
          d.dirX = dx / distance;
          d.dirY = dy / distance;
          let goal =
            on && distance < RADIUS
              ? 0.5 * RADIUS * (1 - distance / RADIUS) ** 2
              : 0;
          for (const pulse of pulses) {
            const front = pulse.age * 760;
            const fromPulse = Math.hypot(home.sx - pulse.x, home.sy - pulse.y);
            const band = 1 - Math.abs(fromPulse - front) / 70;
            if (band > 0) goal += 26 * band * (1 - pulse.age / 1.3);
          }
          d.push = approach(d.push, goal, goal > d.push ? 9 : 3.5, dt);
          if (goal === 0 && d.push < 0.2) {
            // At rest again exactly at home: hand it back.
            parted.delete(index);
            d.push = 0;
            borrow.release(proxy, { duration: 0.001 });
          }
        }
      },
      select() {
        pulses.push({ x: cur.x, y: cur.y, age: 0 });
      },
      press() {
        if (!finePointer) pulses.push({ x: pointer.x, y: pointer.y, age: 0 });
      },
    };
  }

  // 3. Trail: a tip that draws a trace rooted in the space.
  function trail() {
    const TIP = 6;
    const MAX = finePointer ? 180 : 110;
    const tip = [];
    const trace = [];
    let underline = [];
    let travelled = 0;
    const tipTarget = (proxy, out, now) => {
      const d = proxy.data;
      const angle = d.phase + now * 2.2;
      return borrow.localAt(
        cur.x + Math.cos(angle) * d.r,
        cur.y + Math.sin(angle) * d.r,
        depth(),
        out,
      );
    };
    const fixed = (proxy, out) => {
      out.world = true;
      out.x = proxy.data.wx;
      out.y = proxy.data.wy;
      out.z = proxy.data.wz;
      return out;
    };
    const lineTarget = (proxy, out, now) => {
      const d = proxy.data;
      return borrow.localAt(
        d.lx + Math.sin(now * 1.7 + d.slot) * 0.6,
        d.ly + (d.slot % 2) * (finePointer ? 3.2 : 2.4),
        depth(),
        out,
      );
    };
    const scratch = { x: 0, y: 0, z: 0 };
    const drop = (proxy, bend = 0.15) =>
      borrow.release(proxy, { duration: 1.6 + hash(proxy.air, 3) * 1.4, bend });
    return {
      update(now, dt, on) {
        const px = cur.x;
        const py = cur.y;
        cur.x = approach(cur.x, pointer.x, 34, dt);
        cur.y = approach(cur.y, pointer.y, 34, dt);
        if (!on) {
          while (tip.length) drop(tip.pop());
        } else if (tip.length < TIP) {
          for (const index of nearest(cur.x, cur.y, TIP - tip.length)) {
            const proxy = borrow.take(index, "cursor");
            if (!proxy) continue;
            proxy.data.phase = hash(index, 1) * TAU;
            proxy.data.r = 1 + hash(index, 2) * 2.6;
            tip.push(proxy);
            borrow.send(proxy, tipTarget, {
              duration: 0.5,
              ease: easeOutCubic,
            });
          }
        }
        // Each stretch of travel roots one particle where the tip just was.
        travelled += on ? Math.hypot(cur.x - px, cur.y - py) : 0;
        const spacing = finePointer ? 9 : 12;
        while (travelled > spacing && trace.length < MAX) {
          travelled -= spacing;
          const t = travelled / Math.max(Math.hypot(cur.x - px, cur.y - py), 1);
          const sx = cur.x + (px - cur.x) * clamp01(t);
          const sy = cur.y + (py - cur.y) * clamp01(t);
          const [index] = nearest(sx, sy, 1, 260);
          const chosen = index ?? nearest(sx, sy, 1)[0];
          if (chosen === undefined) break;
          const proxy = borrow.take(chosen, "trace");
          if (!proxy) break;
          borrow.localAt(
            sx + (hash(chosen, 4) - 0.5) * 5,
            sy + (hash(chosen, 5) - 0.5) * 5,
            depth() + (hash(chosen, 6) - 0.5) * 1.5,
            scratch,
          );
          borrow.toWorld(scratch.x, scratch.y, scratch.z, scratch);
          proxy.data.wx = scratch.x;
          proxy.data.wy = scratch.y;
          proxy.data.wz = scratch.z;
          proxy.data.until = now + 1.3 + hash(chosen, 7) * 0.9;
          trace.push(proxy);
          borrow.send(proxy, fixed, {
            duration: 0.35 + hash(chosen, 8) * 0.25,
            ease: easeOutCubic,
            bend: 0.1,
          });
        }
        if (travelled > spacing) travelled = 0;
        for (let n = trace.length - 1; n >= 0; n -= 1) {
          if (now > trace[n].data.until) drop(trace.splice(n, 1)[0]);
        }
      },
      hover(key) {
        for (const proxy of underline) drop(proxy, 0.1);
        underline = [];
        if (!key) return;
        const scope = `[data-screen~="${menu.screen}"]`;
        const node = document.querySelector(
          `${scope} [data-mode="${key}"], ${scope} [data-action="${key}"]`,
        );
        if (!node) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        const box = text.width > 0 ? text : node.getBoundingClientRect();
        const count = Math.min(
          90,
          Math.round(box.width / (finePointer ? 4 : 5)) * 2,
        );
        const y = box.bottom + (finePointer ? 6 : 5);
        // The trace is used first, then the nearest air.
        const pool = trace.splice(Math.max(0, trace.length - count));
        const more = nearest(
          box.left + box.width / 2,
          y,
          count - pool.length,
          1e9,
        );
        for (const index of more) {
          const proxy = borrow.take(index, "underline");
          if (proxy) pool.push(proxy);
        }
        pool.sort((a, b) => a.x - b.x);
        pool.forEach((proxy, slot) => {
          proxy.data.slot = slot;
          proxy.data.lx =
            box.left +
            (Math.floor(slot / 2) / Math.max(count / 2 - 1, 1)) * box.width;
          proxy.data.ly = y;
          borrow.send(proxy, lineTarget, {
            delay: (Math.floor(slot / 2) / (count / 2)) * 0.18,
            duration: 0.5 + hash(slot, 9) * 0.2,
            ease: easeOutCubic,
            bend: 0.14,
          });
        });
        underline = pool;
      },
    };
  }

  return { mode };
}
