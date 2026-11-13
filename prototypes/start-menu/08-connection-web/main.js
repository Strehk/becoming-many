/**
 * Connection Web: the finale's web linking vegetation, scent emitters, rocks
 * and soil. While loading, links grow outward from the title one by one. The
 * three menu items are nodes; pointing at one sends amber pulses along the
 * shortest path from the title to it. The pointer itself joins the web.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  COLORS,
  createRenderer,
  LineBatch,
  PointBatch,
  rgb,
  rng,
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "08-connection-web", loadSeconds: 7 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  background: COLORS.haze,
  lightColor: COLORS.pulse,
  relief: 0.18,
  glint: 0.4,
});

const random = rng(73);
const ACTIONS = ["start", "settings", "credits"];
// Node sources and their authored weights in the finale.
const SOURCES = [
  { color: 0xa5bdc3, weight: 1 },
  { color: 0xd06780, weight: 1 },
  { color: 0x292e55, weight: 0.25 },
  { color: 0xf2e3d3, weight: 0.2 },
];
const pickSource = () => {
  const total = SOURCES.reduce((sum, source) => sum + source.weight, 0);
  let roll = random() * total;
  for (const source of SOURCES) {
    roll -= source.weight;
    if (roll <= 0) return source;
  }
  return SOURCES[0];
};

const NODE_COUNT = 90;
let nodes = [];
let edges = [];
let parents = [];
const labels = [...document.querySelectorAll("[data-node]")];

function menuSlots(width, height) {
  const portrait = height > width * 1.1;
  return portrait
    ? [
        [0.5, 0.56],
        [0.3, 0.72],
        [0.7, 0.84],
      ]
    : [
        [0.24, 0.66],
        [0.5, 0.76],
        [0.76, 0.66],
      ];
}

function build(width, height) {
  // Pulses address edges by index; a rebuilt web invalidates them.
  for (const pulse of pulses) pulse.alive = false;
  nodes = [];
  // Node 0 is the root under the title; 1-3 are the menu nodes.
  nodes.push({
    bx: 0.5,
    by: 0.3,
    color: rgb(COLORS.depth),
    size: 10,
    menu: -1,
  });
  menuSlots(width, height).forEach(([bx, by], index) => {
    nodes.push({
      bx,
      by,
      color: rgb(SOURCES[index % 2].color),
      size: 16,
      menu: index,
    });
  });
  let attempts = 0;
  while (nodes.length < NODE_COUNT && attempts < 4000) {
    attempts += 1;
    const bx = 0.03 + random() * 0.94;
    const by = 0.04 + random() * 0.92;
    const tooClose = nodes.some(
      (node) =>
        Math.hypot((node.bx - bx) * width, (node.by - by) * height) < 60,
    );
    if (tooClose) continue;
    const source = pickSource();
    nodes.push({
      bx,
      by,
      color: rgb(source.color),
      size: 5 + random() * 7,
      menu: -1,
    });
  }
  for (const node of nodes) {
    node.phase = random() * Math.PI * 2;
    node.glass = random() < 0.4 ? 1 : 0;
  }
  // Link each node to its nearest neighbours.
  const keys = new Set();
  edges = [];
  nodes.forEach((node, i) => {
    const nearest = nodes
      .map((other, j) => [
        j,
        Math.hypot((other.bx - node.bx) * width, (other.by - node.by) * height),
      ])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
    for (const [j] of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (keys.has(key)) continue;
      keys.add(key);
      edges.push({ a: i, b: j, order: 0, glow: 0 });
    }
  });
  // Breadth-first from the root: growth order and shortest paths.
  const adjacency = nodes.map(() => []);
  edges.forEach((edge, index) => {
    adjacency[edge.a].push([edge.b, index]);
    adjacency[edge.b].push([edge.a, index]);
  });
  parents = nodes.map(() => null);
  const seen = new Set([0]);
  const queue = [0];
  let order = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    for (const [next, edgeIndex] of adjacency[current]) {
      if (edges[edgeIndex].order === 0) {
        order += 1;
        edges[edgeIndex].order = order;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      parents[next] = [current, edgeIndex];
      queue.push(next);
    }
  }
  for (const edge of edges) if (edge.order === 0) edge.order = order + 1;
  const maximum = Math.max(...edges.map((edge) => edge.order));
  for (const edge of edges) edge.order /= maximum;
}

function pathTo(target) {
  const path = [];
  let current = target;
  while (parents[current]) {
    path.unshift(current);
    current = parents[current][0];
  }
  path.unshift(0);
  return path;
}

const lines = new LineBatch(1200);
const points = new PointBatch(NODE_COUNT + 600);
const pulses = Array.from({ length: 220 }, () => ({ alive: false }));
const depth = rgb(COLORS.depth);
const amber = rgb(COLORS.pulse);
let hovered = -1;
let hoverPath = [];
let trainClock = 0;
let dim = 0;
let lastSize = "";

menu.on("hover", (key) => {
  hovered = ACTIONS.indexOf(key);
  hoverPath = hovered >= 0 ? pathTo(hovered + 1) : [];
  trainClock = 0;
});

function spawnPulse(edgeIndex, reverse) {
  const pulse = pulses.find((candidate) => !candidate.alive);
  if (!pulse) return;
  pulse.alive = true;
  pulse.edge = edgeIndex;
  pulse.t = 0;
  pulse.reverse = reverse;
  pulse.speed = 0.6 + random() * 0.5;
}

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const size = `${width}x${height}`;
  if (size !== lastSize) {
    build(width, height);
    lastSize = size;
  }
  const speed = menu.motion;
  const launching = menu.screen === "launch";
  dim = approach(
    dim,
    ["settings", "credits", "modes", "launch"].includes(menu.screen) ? 1 : 0,
    3,
    dt,
  );
  const grown = menu.progress;

  // Current node positions: a slow breathing drift plus parallax.
  const positions = nodes.map((node) => {
    const drift = node.menu >= 0 || node === nodes[0] ? 2 : 7;
    return [
      node.bx * width +
        Math.sin(time * 0.3 * speed + node.phase) * drift +
        menu.input.x * 14,
      node.by * height +
        Math.cos(time * 0.26 * speed + node.phase) * drift +
        menu.input.y * 10,
    ];
  });
  labels.forEach((label, index) => {
    const [x, y] = positions[index + 1];
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
  });

  // Ambient pulses on grown edges; a dense train along the hovered path.
  const ambientRate = (launching ? 40 : 3) * menu.quality * speed;
  if (random() < ambientRate * dt) {
    const edgeIndex = Math.floor(random() * edges.length);
    if (edges[edgeIndex].order <= grown) spawnPulse(edgeIndex, random() < 0.5);
  }
  trainClock += dt * speed;

  lines.reset();
  points.reset();
  for (const edge of edges) {
    const reveal = Math.min(Math.max((grown - edge.order) * 25 + 1, 0), 1);
    if (reveal <= 0) continue;
    edge.glow = approach(edge.glow, 0, 1.5, dt);
    const [ax, ay] = positions[edge.a];
    const [bx, by] = positions[edge.b];
    const ex = ax + (bx - ax) * reveal;
    const ey = ay + (by - ay) * reveal;
    lines.push(
      ax,
      ay,
      ex,
      ey,
      1.2 + edge.glow * 1.2,
      edge.glow > 0.05 ? amber : depth,
      (0.22 + edge.glow * 0.6) * (1 - dim * 0.6),
    );
  }

  // The hovered path: pulses march from the title node to the menu node.
  if (hoverPath.length > 1) {
    const segments = hoverPath.length - 1;
    for (let k = 0; k < 4; k += 1) {
      const s = ((trainClock * 1.4 + k / 4) % 1) * segments;
      const segment = Math.min(Math.floor(s), segments - 1);
      const local = s - segment;
      const [ax, ay] = positions[hoverPath[segment]];
      const [bx, by] = positions[hoverPath[segment + 1]];
      points.push(
        ax + (bx - ax) * local,
        ay + (by - ay) * local,
        9,
        amber,
        1,
        1,
        1,
      );
    }
    for (let i = 0; i < segments; i += 1) {
      const [ax, ay] = positions[hoverPath[i]];
      const [bx, by] = positions[hoverPath[i + 1]];
      lines.push(ax, ay, bx, by, 2.4, amber, 0.75);
    }
  }

  for (const pulse of pulses) {
    if (!pulse.alive) continue;
    pulse.t += dt * pulse.speed * speed * (launching ? 2.5 : 1);
    if (pulse.t >= 1) {
      pulse.alive = false;
      continue;
    }
    const edge = edges[pulse.edge];
    if (!edge) {
      pulse.alive = false;
      continue;
    }
    edge.glow = Math.max(edge.glow, 0.6);
    const t = pulse.reverse ? 1 - pulse.t : pulse.t;
    const [ax, ay] = positions[edge.a];
    const [bx, by] = positions[edge.b];
    points.push(
      ax + (bx - ax) * t,
      ay + (by - ay) * t,
      6,
      amber,
      0.95 * (1 - dim * 0.4),
      0.7,
      0,
    );
  }

  // Pointer joins the web: faint links to close nodes.
  if (menu.input.pointerActive && menu.screen === "menu") {
    positions.forEach(([x, y], index) => {
      const distance = Math.hypot(x - menu.input.px, y - menu.input.py);
      if (distance < 150) {
        lines.push(
          menu.input.px,
          menu.input.py,
          x,
          y,
          1,
          depth,
          (1 - distance / 150) * 0.35,
        );
        if (index > 0 && random() < dt * 2) {
          const edgeIndex = edges.findIndex(
            (edge) => edge.a === index || edge.b === index,
          );
          if (edgeIndex >= 0)
            spawnPulse(edgeIndex, edges[edgeIndex].b === index);
        }
      }
    });
  }

  nodes.forEach((node, index) => {
    const touched = edges.some(
      (edge) =>
        (edge.a === index || edge.b === index) && edge.order <= grown + 0.02,
    );
    if (!touched && index !== 0) return;
    const [x, y] = positions[index];
    const isHovered = node.menu >= 0 && node.menu === hovered;
    const beat = isHovered ? 0.5 + 0.5 * Math.sin(time * 6) : 0;
    const scale = node.menu >= 0 ? 0.6 + 0.4 * Math.min(grown * 1.2, 1) : 1;
    points.push(
      x,
      y,
      node.size * scale * (1 + beat * 0.35),
      node.color,
      1 - dim * 0.55,
      beat,
      node.glass,
    );
  });

  renderer.clear();
  renderer.drawLines(lines);
  renderer.drawPoints(points);
});
