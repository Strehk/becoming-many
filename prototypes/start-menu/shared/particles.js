/**
 * Purpose: Draw the start-menu prototypes' particles with one small WebGL renderer.
 * Context: The prototypes borrow the piece's first and last particle languages:
 *   the Start level's air motes, teal path trail and dust-grain rings with their
 *   orange light sweep, and the finale's scent signatures and connection web.
 * Responsibility: Own the canvas context, point and line batches, the frame loop,
 *   the shared palette, and small sampling helpers.
 * Boundary: Standalone design prototype; nothing here is imported by the game.
 */

// 1. Palette taken from the authored level recipes
export const COLORS = {
  paper: 0xffffff,
  haze: 0xf7f7f7,
  ink: 0x202126,
  black: 0x000000,
  // Start level
  air: 0x899096,
  pathFrom: 0x2c858d,
  pathTo: 0x77bec2,
  light: 0xfb5f16,
  sun: 0xf0bc50,
  // Finale: plant scent signatures
  scent: [0x55d1ba, 0x6adadd, 0xb185c2, 0x50be81, 0xa865c7, 0xb2a17f],
  // Finale: animal scent signatures
  animal: [0xfdbb54, 0xef8f3c, 0xfda39d, 0xd8919c],
  // Finale: connection web
  nodes: [0xa5bdc3, 0xd06780, 0x292e55, 0xf2e3d3],
  pulse: 0xe39e54,
  depth: 0x683b5a,
  // Finale: thermal ramp, coldest to hottest
  thermal: [0x0e0628, 0x072b7d, 0x1c6c8b, 0xd5198a, 0xfb5f16, 0xfcce43],
};

export function rgb(hex) {
  return [
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
  ];
}

export function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Deterministic random numbers so every reload composes the same field. */
export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) ** 3;
/** Frame-rate independent approach toward a target. */
export const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/** Smooth pseudo-flow field built from layered sines; cheap and seamless. */
export function flow(x, y, t) {
  const a = Math.sin(x * 1.7 + t * 0.31) + Math.sin(y * 2.3 - t * 0.23);
  const b = Math.cos(x * 2.1 - t * 0.27) + Math.cos(y * 1.3 + t * 0.19);
  return [Math.sin(a * 1.3 + y), Math.cos(b * 1.1 + x)];
}

// 2. Batches: interleaved vertex data rebuilt every frame
const POINT_STRIDE = 9; // x, y, size, r, g, b, a, light, glass
const LINE_STRIDE = 6; // x, y, r, g, b, a

export class PointBatch {
  constructor(capacity) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * POINT_STRIDE);
    this.count = 0;
  }
  reset() {
    this.count = 0;
  }
  /** Size is a CSS-pixel diameter; light raises the orange sweep; glass adds a glint. */
  push(x, y, size, color, alpha, light = 0, glass = 0) {
    if (this.count >= this.capacity || alpha <= 0.002) return;
    const o = this.count * POINT_STRIDE;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = size;
    d[o + 3] = color[0];
    d[o + 4] = color[1];
    d[o + 5] = color[2];
    d[o + 6] = alpha;
    d[o + 7] = light;
    d[o + 8] = glass;
    this.count += 1;
  }
}

export class LineBatch {
  constructor(segmentCapacity) {
    this.capacity = segmentCapacity;
    this.data = new Float32Array(segmentCapacity * 6 * LINE_STRIDE);
    this.count = 0; // vertices
  }
  reset() {
    this.count = 0;
  }
  /** One segment as two triangles so width survives WebGL's 1px line limit. */
  push(x1, y1, x2, y2, width, color, alpha) {
    if (this.count / 6 >= this.capacity || alpha <= 0.002) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * width * 0.5;
    const ny = (dx / length) * width * 0.5;
    const corners = [
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x2 + nx, y2 + ny],
      [x2 + nx, y2 + ny],
      [x1 - nx, y1 - ny],
      [x2 - nx, y2 - ny],
    ];
    const d = this.data;
    for (const [cx, cy] of corners) {
      const o = this.count * LINE_STRIDE;
      d[o] = cx;
      d[o + 1] = cy;
      d[o + 2] = color[0];
      d[o + 3] = color[1];
      d[o + 4] = color[2];
      d[o + 5] = alpha;
      this.count += 1;
    }
  }
}

// 3. Shaders: the grain mirrors the Start level's dust-grain shading
const POINT_VERTEX = `
attribute vec2 position;
attribute float size;
attribute vec4 color;
attribute float light;
attribute float glass;
uniform vec2 viewport;
uniform float pixelRatio;
uniform float lightSizeBoost;
uniform float maxPointSize;
varying vec4 vColor;
varying float vLight;
varying float vGlass;
void main() {
  vec2 clip = position / viewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = clamp(size * pixelRatio * (1.0 + light * lightSizeBoost), 1.0, maxPointSize);
  vColor = color;
  vLight = light;
  vGlass = glass;
}`;

const POINT_FRAGMENT = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
uniform vec3 lightColor;
uniform float relief;
uniform float glintStrength;
uniform float glow;
varying vec4 vColor;
varying float vLight;
varying float vGlass;
void main() {
  vec2 disc = gl_PointCoord * 2.0 - 1.0;
  float radius = length(disc);
  float feather = max(fwidth(radius), 0.04);
  float hard = 1.0 - smoothstep(1.0 - feather, 1.0, radius);
  float soft = exp(-radius * radius * 3.2) * (1.0 - smoothstep(0.85, 1.0, radius));
  float coverage = mix(hard, soft, glow);
  vec3 normal = vec3(disc.x, -disc.y, sqrt(max(0.0, 1.0 - dot(disc, disc))));
  float shade = max(0.0, dot(normal, normalize(vec3(-0.45, 0.65, 0.65))));
  vec3 pigment = vColor.rgb + vec3(shade * shade * relief);
  float glint = pow(max(0.0, dot(normal, normalize(vec3(-0.35, 0.45, 0.82)))), 24.0);
  float intensity = clamp(vLight, 0.0, 1.0);
  pigment = mix(pigment, lightColor, intensity) + vec3(glint * vGlass * vLight * glintStrength);
  gl_FragColor = vec4(pigment, vColor.a * coverage);
}`;

const LINE_VERTEX = `
attribute vec2 position;
attribute vec4 color;
uniform vec2 viewport;
varying vec4 vColor;
void main() {
  vec2 clip = position / viewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vColor = color;
}`;

const LINE_FRAGMENT = `
precision mediump float;
varying vec4 vColor;
void main() { gl_FragColor = vColor; }`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
  }
  return shader;
}

function link(gl, vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
  }
  return program;
}

// 4. Renderer
/**
 * Options: background (hex), lightColor (hex), relief, glint, glow (0 hard grain,
 * 1 soft mote), lightSizeBoost, blend ("normal" | "additive").
 */
export function createRenderer(canvas, options = {}) {
  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL unavailable");
  gl.getExtension("OES_standard_derivatives");

  const settings = {
    background: COLORS.paper,
    lightColor: COLORS.light,
    relief: 0.12,
    glint: 0.45,
    glow: 0,
    lightSizeBoost: 0.8,
    blend: "normal",
    ...options,
  };

  const pointProgram = link(gl, POINT_VERTEX, POINT_FRAGMENT);
  const lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT);
  const pointBuffer = gl.createBuffer();
  const lineBuffer = gl.createBuffer();
  const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);

  const attributes = (program, names) =>
    Object.fromEntries(
      names.map((name) => [name, gl.getAttribLocation(program, name)]),
    );
  const uniforms = (program, names) =>
    Object.fromEntries(
      names.map((name) => [name, gl.getUniformLocation(program, name)]),
    );

  const pointAttributes = attributes(pointProgram, [
    "position",
    "size",
    "color",
    "light",
    "glass",
  ]);
  const pointUniforms = uniforms(pointProgram, [
    "viewport",
    "pixelRatio",
    "lightSizeBoost",
    "maxPointSize",
    "lightColor",
    "relief",
    "glintStrength",
    "glow",
  ]);
  const lineAttributes = attributes(lineProgram, ["position", "color"]);
  const lineUniforms = uniforms(lineProgram, ["viewport"]);

  const state = { width: 1, height: 1, pixelRatio: 1 };

  function resize() {
    state.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    state.width = canvas.clientWidth || window.innerWidth;
    state.height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(state.width * state.pixelRatio);
    canvas.height = Math.round(state.height * state.pixelRatio);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  function setBlend() {
    gl.enable(gl.BLEND);
    if (settings.blend === "additive") gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
  }

  function clear(hex = settings.background) {
    const [r, g, b] = rgb(hex);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function bindAttribute(location, size, stride, offset) {
    if (location < 0) return;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(
      location,
      size,
      gl.FLOAT,
      false,
      stride * 4,
      offset * 4,
    );
  }

  function drawPoints(batch, overrides = {}) {
    if (batch.count === 0) return;
    const look = { ...settings, ...overrides };
    gl.useProgram(pointProgram);
    setBlend();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      batch.data.subarray(0, batch.count * POINT_STRIDE),
      gl.DYNAMIC_DRAW,
    );
    bindAttribute(pointAttributes.position, 2, POINT_STRIDE, 0);
    bindAttribute(pointAttributes.size, 1, POINT_STRIDE, 2);
    bindAttribute(pointAttributes.color, 4, POINT_STRIDE, 3);
    bindAttribute(pointAttributes.light, 1, POINT_STRIDE, 7);
    bindAttribute(pointAttributes.glass, 1, POINT_STRIDE, 8);
    gl.uniform2f(pointUniforms.viewport, state.width, state.height);
    gl.uniform1f(pointUniforms.pixelRatio, state.pixelRatio);
    gl.uniform1f(pointUniforms.lightSizeBoost, look.lightSizeBoost);
    gl.uniform1f(pointUniforms.maxPointSize, pointRange[1]);
    gl.uniform3fv(pointUniforms.lightColor, rgb(look.lightColor));
    gl.uniform1f(pointUniforms.relief, look.relief);
    gl.uniform1f(pointUniforms.glintStrength, look.glint);
    gl.uniform1f(pointUniforms.glow, look.glow);
    gl.drawArrays(gl.POINTS, 0, batch.count);
  }

  function drawLines(batch) {
    if (batch.count === 0) return;
    gl.useProgram(lineProgram);
    setBlend();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      batch.data.subarray(0, batch.count * LINE_STRIDE),
      gl.DYNAMIC_DRAW,
    );
    bindAttribute(lineAttributes.position, 2, LINE_STRIDE, 0);
    bindAttribute(lineAttributes.color, 4, LINE_STRIDE, 2);
    gl.uniform2f(lineUniforms.viewport, state.width, state.height);
    gl.drawArrays(gl.TRIANGLES, 0, batch.count);
  }

  /** Calls frame(timeSeconds, deltaSeconds) every animation frame. */
  function loop(frame) {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame(now / 1000, dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return {
    gl,
    settings,
    get width() {
      return state.width;
    },
    get height() {
      return state.height;
    },
    clear,
    drawPoints,
    drawLines,
    loop,
  };
}

// 5. Sampling helpers
/**
 * Rasterises text in Rubik and returns points inside the glyphs, in CSS pixels
 * relative to the given box. Waits for the font so the shapes are true.
 */
export async function sampleText(
  text,
  { width, height, size, weight = 700, step = 4, letterSpacing = 0 },
) {
  await document.fonts.load(`${weight} ${size}px Rubik`);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#000";
  context.font = `${weight} ${size}px Rubik, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if ("letterSpacing" in context) context.letterSpacing = `${letterSpacing}px`;
  context.fillText(text, width / 2, height / 2);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const points = [];
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 128) points.push([x, y]);
    }
  }
  return points;
}

/** Points on a ring with an empty centre, like the Start level's dust-grain rings. */
export function sampleRing(count, radius, thickness, random) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const spread = (random() + random() + random() - 1.5) / 1.5;
    const r = radius + spread * thickness;
    points.push([Math.cos(angle) * r, Math.sin(angle) * r, angle]);
  }
  return points;
}
