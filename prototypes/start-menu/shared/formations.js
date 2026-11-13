/**
 * Purpose: The figures the swarm forms while the piece loads.
 * Context: Each formation is a function of particle index and time that answers
 *   with a point in CSS pixels from the screen centre, the alpha it should
 *   have, or false to leave the particle in the drift. The swarm springs each
 *   particle toward its point, so moving points read as flight.
 * Responsibility: A progress ring, a progress horizon, and one figure per sense
 *   in the order the show introduces them.
 * Boundary: Which figure shows when belongs to the variant.
 */

const GOLDEN = 0.6180339887;
const TAU = Math.PI * 2;
const frac = (value) => value - Math.floor(value);
const hash = (index, salt = 0) =>
  frac(Math.sin(index * 127.1 + salt * 311.7) * 43758.5453);

const scaleOf = (view) => Math.min(view.width, view.height);

/** A ring that closes clockwise with the progress, slowly turning. */
export function ringFormation(swarm, getProgress, { count = 520 } = {}) {
  return {
    count,
    at(index, t, out) {
      const share = index / count;
      if (share > getProgress()) return false;
      const view = swarm.view;
      const radius = scaleOf(view) * 0.2;
      const lane = (index % 3) - 1;
      const angle = -Math.PI / 2 + share * TAU + Math.sin(t * 0.2) * 0.02;
      const r =
        radius + lane * swarm.pixelSize * 1.3 + Math.sin(t * 1.3 + index) * 0.6;
      out.x = Math.cos(angle) * r;
      out.y = Math.sin(angle) * r;
      return true;
    },
  };
}

/** A horizon that fills from the left with the progress. */
export function horizonFormation(
  swarm,
  getProgress,
  { count = 620, left = () => 0, right = () => 1, y = () => 0 } = {},
) {
  return {
    count,
    at(index, t, out) {
      const share = index / count;
      if (share > getProgress()) return false;
      const view = swarm.view;
      const x0 = left(view);
      const x1 = right(view);
      const lane = index % 2;
      out.x = x0 + share * (x1 - x0) - view.width / 2;
      out.y =
        y(view) -
        view.height / 2 +
        lane * swarm.pixelSize * 1.2 +
        Math.sin(share * 18 + t * 0.9) * swarm.pixelSize * 0.5;
      return true;
    },
  };
}

// The senses, in the order the show introduces them.

/** Air: the drift slowly thickens into one loose, breathing cloud. */
function air(swarm, count) {
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.32;
      const a = hash(index, 1) * TAU + t * 0.05;
      const r =
        Math.sqrt(hash(index, 2)) * s * (0.92 + Math.sin(t * 0.8) * 0.06);
      out.x = Math.cos(a) * r * 1.25;
      out.y = Math.sin(a) * r * 0.85;
      out.depth = (hash(index, 3) - 0.5) * 6;
      return true;
    },
  };
}

/** Scent: a plume rising from below and curling as it thins. */
function scent(swarm, count) {
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.36;
      const h = frac(hash(index, 4) + t * 0.09);
      const curl = Math.sin(h * 5 + t * 0.6 + hash(index, 5) * 0.8);
      const spread = (hash(index, 6) - 0.5) * (0.08 + h * 0.7) * s;
      out.x = curl * s * 0.22 * h + spread;
      out.y = s * (1 - 2.1 * h);
      out.a = Math.min(1, h * 8, (1 - h) * 3);
      out.depth = (hash(index, 7) - 0.5) * 3;
      return true;
    },
  };
}

/** Echo: calls going out as rings; what comes back is distance. */
function echo(swarm, count) {
  const rings = 3;
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.46;
      const ring = index % rings;
      const p = frac(t * 0.22 + ring / rings);
      const a = (index * GOLDEN * TAU) % TAU;
      const r = (0.08 + p * 0.92) * s;
      out.x = Math.cos(a) * r * 1.15;
      out.y = Math.sin(a) * r;
      // Solid while it travels, gone just before it starts again.
      out.a = Math.min(1, (1 - p) * 5, p * 12);
      return true;
    },
  };
}

/** Motion: what moves leaves a trace; streams drawn across the view. */
function motion(swarm, count) {
  const lanes = 7;
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.5;
      const lane = index % lanes;
      const u = frac(hash(index, 8) + t * (0.07 + lane * 0.012));
      out.x = (u - 0.5) * s * 2.6;
      out.y =
        (lane / (lanes - 1) - 0.5) * s * 0.9 +
        Math.sin(u * 5 + t * 0.7 + lane) * s * 0.07;
      out.a = Math.min(1, u * 6, (1 - u) * 6);
      return true;
    },
  };
}

/** Thermal: two convection rolls turning against each other. */
function thermal(swarm, count) {
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.36;
      const side = index % 2 ? 1 : -1;
      const a = hash(index, 9) * TAU + t * 0.55 * side;
      const r = s * (0.25 + hash(index, 10) * 0.32);
      out.x = side * s * 0.62 + Math.cos(a) * r * side;
      out.y = Math.sin(a) * r * 1.2 - Math.abs(Math.cos(a)) * s * 0.1;
      return true;
    },
  };
}

/** Magnetic: field lines of a dipole, north up, particles running along them. */
function magnetic(swarm, count) {
  const shells = [0.38, 0.62, 0.86, 1.1];
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.4;
      const shell = shells[index % shells.length] * s;
      const side = Math.floor(index / shells.length) % 2 ? 1 : -1;
      const u = frac(hash(index, 11) + t * 0.05);
      const theta = 0.2 + u * (Math.PI - 0.4);
      const sin = Math.sin(theta);
      const r = shell * sin * sin;
      out.x = side * r * sin * 1.3;
      out.y = -r * Math.cos(theta);
      out.a = Math.min(1, u * 8, (1 - u) * 8);
      return true;
    },
  };
}

/** Connections: nodes in the soil and signals running along their threads. */
function connections(swarm, count) {
  const nodes = [];
  for (let index = 0; index < 22; index += 1) {
    const a = hash(index, 12) * TAU;
    const r = Math.sqrt(hash(index, 13));
    nodes.push([Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.85]);
  }
  const edges = [];
  nodes.forEach((node, from) => {
    const nearest = nodes
      .map((other, to) => [
        to,
        Math.hypot(other[0] - node[0], other[1] - node[1]),
      ])
      .filter(([to]) => to !== from)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
    for (const [to] of nearest) {
      const known = edges.some(
        ([a, b]) => (a === from && b === to) || (a === to && b === from),
      );
      if (!known) edges.push([from, to]);
    }
  });
  return {
    count,
    at(index, t, out) {
      const s = scaleOf(swarm.view) * 0.36;
      const onNode = index % 5 === 0;
      if (onNode) {
        const node = nodes[index % nodes.length];
        const a = hash(index, 14) * TAU;
        const r = hash(index, 15) * s * 0.035;
        out.x = node[0] * s + Math.cos(a) * r;
        out.y = node[1] * s + Math.sin(a) * r;
        return true;
      }
      const [from, to] = edges[index % edges.length];
      // Particles stream along the thread, one way, like a signal.
      const u = frac(hash(index, 16) + t * 0.12 * (hash(from + to, 18) + 0.5));
      const a = nodes[from];
      const b = nodes[to];
      const bend = Math.sin(u * Math.PI) * 0.06 * (hash(from + to, 17) - 0.5);
      out.x = (a[0] + (b[0] - a[0]) * u - (b[1] - a[1]) * bend) * s;
      out.y = (a[1] + (b[1] - a[1]) * u + (b[0] - a[0]) * bend) * s;
      out.a = Math.min(1, u * 8, (1 - u) * 8);
      return true;
    },
  };
}

export const SENSE_FORMATIONS = [
  air,
  scent,
  echo,
  motion,
  thermal,
  magnetic,
  connections,
];
