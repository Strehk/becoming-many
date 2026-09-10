import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  type PointsMaterial,
  type Scene,
  Vector3,
} from "three";
import type { WorldModule } from "../../../world/module-runtime";
import type { Viewpoint } from "../../../world/viewpoint";

// 1. Settings
// One fixed left-turn exercise. Its presentation reuses Start's airborne particles.
const SETTINGS = {
  revealDelaySeconds: 2,
  leadMeters: 9,
  straightMeters: 5,
  turnRadiusMeters: 20,
  turnRadians: Math.PI / 3,
  belowFlightMeters: 0.5,
  particleCount: 1400,
  spreadMeters: 0.55,
  seed: 17,
  particles: {
    appearance: {
      color: 0x39999d,
      sizeMeters: 0.04,
      shape: "circle" as const,
    },
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

// 2. Contract
// The local star injects material construction; no concrete sibling imports.
interface PathMaterial {
  readonly pointsMaterial: PointsMaterial;
  readonly update: (deltaSeconds: number) => void;
}
interface FlightPathOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly createMaterial: (
    settings: typeof SETTINGS.particles,
  ) => PathMaterial;
}

/** Own one stationary exercise and its graphics; reveal from the current flight heading. */
export function createFlightPath(options: FlightPathOptions): WorldModule {
  return new FlightPath(options);
}

// 3. Lifetime and demonstration cue
// Attach only when the cue fires. Later motion never moves the exercise's anchor.
class FlightPath implements WorldModule {
  private cloud: Points<BufferGeometry, PointsMaterial> | undefined;
  private material: PathMaterial | undefined;
  private elapsedSeconds = 0;

  constructor(private readonly options: FlightPathOptions) {}

  readonly load = (): void => {
    if (this.cloud) return;
    this.material = this.options.createMaterial(SETTINGS.particles);
    this.cloud = new Points(createPathGeometry(), this.material.pointsMaterial);
    this.cloud.name = "StartFlightPath";
    this.cloud.visible = false;
  };

  readonly activate = (): void => {
    this.elapsedSeconds = 0;
    this.cloud?.removeFromParent();
    if (this.cloud) this.cloud.visible = false;
  };

  readonly update = (deltaSeconds: number): void => {
    if (!this.cloud) return;
    this.elapsedSeconds += deltaSeconds;
    if (this.elapsedSeconds < SETTINGS.revealDelaySeconds) return;
    if (!this.cloud.parent) this.reveal();
    this.material?.update(deltaSeconds);
  };

  private reveal(): void {
    if (!this.cloud) return;
    const { viewpoint, scene } = this.options;
    const direction = viewpoint.worldFlightDirection;
    this.cloud.position.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
    this.cloud.position.y -= SETTINGS.belowFlightMeters;
    this.cloud.rotation.y = direction
      ? Math.atan2(-direction.x, -direction.z)
      : 0;
    this.cloud.visible = true;
    scene.add(this.cloud);
  }

  readonly deactivate = (): void => {
    if (this.cloud) this.cloud.visible = false;
  };

  readonly unload = (): void => {
    if (!this.cloud) return;
    this.cloud.removeFromParent();
    this.cloud.geometry.dispose();
    this.cloud.material.dispose();
    this.cloud = undefined;
    this.material = undefined;
  };
}

// 4. Path geometry
// A straight approach joins a circular arc with a continuous forward tangent.
function sampleRoute(distance: number, target: Vector3): void {
  const turnDistance = Math.max(0, distance - SETTINGS.straightMeters);
  const angle = turnDistance / SETTINGS.turnRadiusMeters;
  target.set(
    -SETTINGS.turnRadiusMeters * (1 - Math.cos(angle)),
    0,
    -SETTINGS.leadMeters -
      Math.min(distance, SETTINGS.straightMeters) -
      SETTINGS.turnRadiusMeters * Math.sin(angle),
  );
}

function createPathGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", createPathPositions());
  geometry.setAttribute(
    "airParticleVisible",
    new Float32BufferAttribute(
      new Float32Array(SETTINGS.particleCount).fill(1),
      1,
    ),
  );
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) {
    const motion = SETTINGS.particles.motion;
    geometry.boundingSphere.radius += Math.hypot(
      motion.horizontalAmplitudeMeters,
      motion.verticalAmplitudeMeters,
    );
  }
  return geometry;
}

// 5. Stable scatter
// Generate once; the material animates bounded wind offsets entirely on the GPU.
function createPathPositions(): Float32BufferAttribute {
  const positions = new Float32BufferAttribute(SETTINGS.particleCount * 3, 3);
  const random = createRandom(SETTINGS.seed);
  const point = new Vector3();
  const length =
    SETTINGS.straightMeters + SETTINGS.turnRadiusMeters * SETTINGS.turnRadians;
  for (let index = 0; index < positions.count; index++) {
    sampleRoute((index / (positions.count - 1)) * length, point);
    point.x += (random() + random() - 1) * SETTINGS.spreadMeters;
    point.y += (random() + random() - 1) * SETTINGS.spreadMeters;
    point.z += (random() + random() - 1) * SETTINGS.spreadMeters;
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  return positions;
}

/** Local deterministic sequence; never changes the application's random state. */
function createRandom(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
