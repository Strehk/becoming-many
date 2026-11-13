/**
 * Purpose: A figure made of borrowed air: a set of particles and their places.
 * Context: Like the tutorial's escort arrow, a figure travels with the visitor
 *   at a fixed spot in front of the eye. It recruits from the air around it,
 *   nearest first, and leaves part of the visible dust in place so the world
 *   keeps its depth while the figure costs it some.
 * Responsibility: Recruit, reshape, hand members to another figure, release.
 * Boundary: The shapes themselves live with the variant or in formations.js.
 */

import { easeInOutCubic, hash } from "./air-borrow.js";

/**
 * A shape answers at(index, time, out): either out.local = true with a
 * camera-local point in metres (out.x, out.y, out.z), or a point in CSS px from the screen centre
 * (out.x, out.y) with optional out.depth (metres added to shape.depth) and
 * out.a (0..1). A particle never fades: a low a sends it back into the depth.
 */
export function shapeTarget(borrow, shape) {
  const point = { x: 0, y: 0, z: 0, depth: 0, a: 1, local: false };
  return (proxy, out, now) => {
    point.x = 0;
    point.y = 0;
    point.depth = 0;
    point.a = 1;
    point.local = false;
    shape.at(proxy.data.index, now, point);
    if (point.local) {
      out.x = point.x;
      out.y = point.y;
      out.z = point.z;
      return out;
    }
    const depth = shape.depth + (point.depth ?? 0) + (1 - (point.a ?? 1)) * 46;
    const view = borrow.view;
    return borrow.localAt(
      view.width / 2 + point.x,
      view.height / 2 + point.y,
      depth,
      out,
    );
  };
}

export function createFigure(borrow, options = {}) {
  const owner = options.owner ?? "figure";
  let members = [];
  let shape = null;
  let target = null;
  let pool = [];
  let poolAt = -10;

  /**
   * Candidates ranked by distance to the figure's centre (camera-local).
   * keepVisible: share of the dust on screen that may be taken; the rest
   * stays, so the world keeps its depth.
   */
  function rankPool({ centre, keepVisible = 0.5, maxMeters = 120 }) {
    const c = borrow.candidates({ maxMeters, maxAge: 0.2 });
    const ranked = [];
    for (let n = 0; n < c.count; n += 1) {
      const index = c.index[n];
      if (c.visible[n] && hash(index, 7) > keepVisible) continue;
      const dx = c.lx[n] - centre.x;
      const dy = c.ly[n] - centre.y;
      const dz = c.lz[n] - centre.z;
      ranked.push([dx * dx + dy * dy + dz * dz, index]);
    }
    ranked.sort((a, b) => a[0] - b[0]);
    pool = ranked.map((entry) => entry[1]);
    poolAt = borrow.view.now;
  }

  const figure = {
    owner,
    get members() {
      return members;
    },
    get count() {
      return members.length;
    },
    get shape() {
      return shape;
    },
    /** Give every member its new place; flights start from where they are. */
    reshape(next, flight = {}) {
      shape = next;
      target = shapeTarget(borrow, shape);
      members.forEach((proxy, index) => {
        proxy.data.index = index;
        const order = flight.order
          ? flight.order(proxy, index)
          : hash(index, 3);
        figure.fly(proxy, {
          delay: (flight.stagger ?? 0) * order,
          duration: (flight.travel ?? 1.4) * (0.82 + hash(index, 5) * 0.18),
          bend: flight.bend ?? 0.16,
        });
      });
    },
    fly(proxy, flight) {
      borrow.send(proxy, target, {
        ease: easeInOutCubic,
        ...flight,
      });
    },
    /**
     * Recruit until the figure has count members. New members fly to their
     * places from where they float.
     */
    fill(count, recruit = {}) {
      if (!shape || members.length >= count) return 0;
      const centre = recruit.centre ?? { x: 0, y: 0, z: -(shape.depth ?? 14) };
      if (pool.length === 0 || borrow.view.now - poolAt > 0.8)
        rankPool({ ...recruit, centre });
      let added = 0;
      while (members.length < count && pool.length > 0) {
        const proxy = borrow.take(pool.shift(), owner);
        if (!proxy) continue;
        proxy.data.index = members.length;
        members.push(proxy);
        figure.fly(proxy, {
          delay: recruit.delay ?? 0,
          duration: (recruit.travel ?? 1.6) * (0.8 + hash(proxy.air, 9) * 0.2),
          bend: recruit.bend ?? 0.18,
        });
        added += 1;
      }
      return added;
    },
    /** Release the last members until count remain. */
    trim(count, release = {}) {
      while (members.length > count) {
        const proxy = members.pop();
        proxy.hidden = false;
        borrow.release(proxy, release);
      }
    },
    release(release = {}) {
      figure.trim(0, release);
    },
    /** Take over another figure's members, in their order. */
    adopt(other) {
      for (const proxy of other.members) {
        proxy.owner = owner;
        members.push(proxy);
      }
      other.forget();
    },
    forget() {
      members = [];
    },
    /** Reorder members; index i gets members[order[i]]. */
    reorder(order) {
      members = order.map((from) => members[from]);
      members.forEach((proxy, index) => {
        proxy.data.index = index;
      });
    },
  };
  return figure;
}
