import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from "three";
import type {
  FlightRoute,
  ParticleRange,
  PathParticleMaterial,
  PathParticleParameters,
} from "./particle-contract";

// 1. Particle settings
const SETTINGS = {
  sectionMeters: 1,
  maximumParticles: 100_000,
  material: {
    appearance: { color: 0xffffff, sizeMeters: 1, shape: "circle" as const },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.16,
      speedMultiplier: 0.65,
    },
    streaming: {
      chunkLevel: 0 as const,
      viewDistanceMeters: 96,
      fadeStartMeters: 72,
    },
  },
};

// 2. Geometry construction
// Sample density per section. Color, size, and scatter remain stable across frames.
/** Create owned particle buffers for any sampled route; reject invalid or excessive settings. */
export function createPathParticleGeometry(
  route: FlightRoute,
  parameters: PathParticleParameters,
): BufferGeometry {
  validateParameters(route, parameters);
  const particles = sampleParticles(route, parameters);
  const geometry = new BufferGeometry();
  const attributes = {
    position: new Float32BufferAttribute(particles.positions, 3),
    routeDistance: new Float32BufferAttribute(particles.distances, 1),
    color: new Float32BufferAttribute(particles.colors, 3),
    pathParticleSize: new Float32BufferAttribute(particles.sizes, 1),
    airParticleVisible: new Float32BufferAttribute(
      particles.sizes.map(() => 1),
      1,
    ),
  };
  for (const [name, attribute] of Object.entries(attributes)) {
    geometry.setAttribute(name, attribute);
  }
  expandWindBounds(geometry);
  return geometry;
}

function expandWindBounds(geometry: BufferGeometry): void {
  geometry.computeBoundingSphere();
  const motion = SETTINGS.material.motion;
  if (geometry.boundingSphere)
    geometry.boundingSphere.radius += Math.hypot(
      motion.horizontalAmplitudeMeters,
      motion.verticalAmplitudeMeters,
    );
}

function sampleParticles(
  route: FlightRoute,
  parameters: PathParticleParameters,
) {
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const random = createRandom(parameters.seed);
  const point = new Vector3();
  const color = new Color();
  const fromColor = new Color(parameters.color.from);
  const toColor = new Color(parameters.color.to);
  const distances = sampleDistances(
    route.lengthMeters,
    parameters.densityPerMeter,
    random,
  );
  for (const distance of distances) {
    route.sample(distance, point);
    scatterPoint(point, parameters.spreadMeters, random);
    positions.push(point.x, point.y, point.z);
    color.lerpColors(fromColor, toColor, random());
    colors.push(color.r, color.g, color.b);
    sizes.push(sampleRange(parameters.sizeMeters, random));
  }
  return { positions, colors, sizes, distances };
}

function sampleDistances(
  lengthMeters: number,
  density: ParticleRange,
  random: () => number,
): number[] {
  const distances: number[] = [];
  const sections = Math.ceil(lengthMeters / SETTINGS.sectionMeters);
  for (let section = 0; section < sections; section++) {
    const start = section * SETTINGS.sectionMeters;
    const length = Math.min(SETTINGS.sectionMeters, lengthMeters - start);
    const count = Math.floor(sampleRange(density, random) * length);
    for (let index = 0; index < count; index++) {
      distances.push(start + ((index + 0.5) / count) * length);
    }
  }
  return distances;
}

// 3. Stable variation
function scatterPoint(
  point: Vector3,
  spread: number,
  random: () => number,
): void {
  point.x += (random() + random() - 1) * spread;
  point.y += (random() + random() - 1) * spread;
  point.z += (random() + random() - 1) * spread;
}

function sampleRange(range: ParticleRange, random: () => number): number {
  return range.from + (range.to - range.from) * random();
}

/** Local deterministic sequence; never changes the application's random state. */
function createRandom(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// 4. Contract validation
function validateParameters(
  route: FlightRoute,
  parameters: PathParticleParameters,
): void {
  validateRange(parameters.densityPerMeter, "densityPerMeter");
  validateRange(parameters.sizeMeters, "sizeMeters");
  if (parameters.sizeMeters.from === 0)
    throw new RangeError("Particle size must be positive");
  for (const color of [parameters.color.from, parameters.color.to]) {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      throw new RangeError("Particle colors must be sRGB hex values");
    }
  }
  if (
    !Number.isFinite(parameters.spreadMeters) ||
    parameters.spreadMeters < 0 ||
    !Number.isInteger(parameters.seed)
  )
    throw new RangeError("Invalid particle scatter or seed");
  validateRouteBudget(route.lengthMeters, parameters.densityPerMeter.to);
}

function validateRouteBudget(
  lengthMeters: number,
  maximumDensity: number,
): void {
  if (
    !Number.isFinite(lengthMeters) ||
    lengthMeters < 0 ||
    Math.ceil(lengthMeters / SETTINGS.sectionMeters) >
      SETTINGS.maximumParticles ||
    lengthMeters * maximumDensity > SETTINGS.maximumParticles
  ) {
    throw new RangeError(
      "Particle route exceeds the bounded generation budget",
    );
  }
}

function validateRange(range: ParticleRange, name: string): void {
  if (
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to) ||
    range.from < 0 ||
    range.to < range.from
  ) {
    throw new RangeError(`Invalid particle range: ${name}`);
  }
}

// 5. Material variation
// Keep the existing circular points, wind, distance fading, and size cap.
/** Extend an injected base material with per-particle sizes and vertex colors. */
export function createPathParticleMaterial(
  createBaseMaterial: (
    settings: typeof SETTINGS.material,
  ) => PathParticleMaterial,
): PathParticleMaterial {
  const material = createBaseMaterial(SETTINGS.material);
  const points = material.pointsMaterial;
  const compileBase = points.onBeforeCompile.bind(points);
  const baseKey = points.customProgramCacheKey();
  points.vertexColors = true;
  points.onBeforeCompile = (shader, renderer) => {
    compileBase(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float pathParticleSize;",
      )
      .replace(
        "gl_PointSize = size;",
        "gl_PointSize = size * pathParticleSize;",
      );
  };
  points.customProgramCacheKey = () => `${baseKey}:path-particle-size-v1`;
  return material;
}
