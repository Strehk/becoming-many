import { BufferGeometry, Float32BufferAttribute, Sphere } from "three";
import type { FlightRoute } from "./particle-contract";

// 1. Incremental generation contract
const MAXIMUM_PARTICLES = 100_000;
interface GenerationOptions {
  readonly route: FlightRoute;
  readonly maximumDensity: number;
  readonly metersPerStep: number;
  readonly createSlice: (
    route: FlightRoute,
    sliceIndex: number,
  ) => BufferGeometry;
}

/** Own unfinished buffers; each step generates one small route slice. */
export function createParticleGeneration(options: GenerationOptions) {
  return new ParticleGeneration(options);
}

function allocateGeometry(capacity: number): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, size] of Object.entries({
    position: 3,
    routeDistance: 1,
    color: 3,
    pathParticleSize: 1,
    airParticleVisible: 1,
  })) {
    geometry.setAttribute(
      name,
      new Float32BufferAttribute(capacity * size, size),
    );
  }
  geometry.setDrawRange(0, 0);
  return geometry;
}

// 2. Bounded work and explicit ownership transfer
class ParticleGeneration {
  private readonly geometry: BufferGeometry;
  private readonly bounds = new Sphere().makeEmpty();
  private offset = 0;
  private distance = 0;
  private sliceIndex = 0;
  private transferred = false;
  private cancelled = false;
  private finished = false;

  constructor(private readonly options: GenerationOptions) {
    const capacity = Math.ceil(
      options.route.lengthMeters * options.maximumDensity,
    );
    if (
      !Number.isFinite(capacity) ||
      capacity < 0 ||
      capacity > MAXIMUM_PARTICLES ||
      !Number.isFinite(options.metersPerStep) ||
      options.metersPerStep <= 0
    ) {
      throw new RangeError("Invalid particle generation budget");
    }
    this.geometry = allocateGeometry(capacity);
  }

  readonly isReady = (): boolean => this.finished && !this.cancelled;

  readonly step = (): boolean => {
    if (this.cancelled || this.finished) return true;
    const start = this.distance;
    const length = Math.min(
      this.options.metersPerStep,
      this.options.route.lengthMeters - start,
    );
    const slice = this.options.createSlice(
      {
        lengthMeters: length,
        sample: (distance, target) =>
          this.options.route.sample(start + distance, target),
      },
      this.sliceIndex++,
    );
    try {
      this.appendSlice(slice);
    } finally {
      slice.dispose();
    }
    this.distance += length;
    if (this.distance >= this.options.route.lengthMeters) this.finish();
    return this.finished;
  };

  private appendSlice(slice: BufferGeometry): void {
    const count = slice.getAttribute("position").count;
    for (const name of Object.keys(this.geometry.attributes)) {
      const target = this.geometry.getAttribute(name) as Float32BufferAttribute;
      target.array.set(
        slice.getAttribute(name).array,
        this.offset * target.itemSize,
      );
    }
    const distances = this.geometry.getAttribute(
      "routeDistance",
    ) as Float32BufferAttribute;
    for (let index = this.offset; index < this.offset + count; index++)
      distances.setX(index, distances.getX(index) + this.distance);
    if (!slice.boundingSphere) slice.computeBoundingSphere();
    if (slice.boundingSphere) this.bounds.union(slice.boundingSphere);
    this.offset += count;
  }

  private finish(): void {
    this.geometry.setDrawRange(0, this.offset);
    this.geometry.boundingSphere = this.bounds.clone();
    this.finished = true;
  }

  readonly takeGeometry = (): BufferGeometry => {
    if (!this.isReady() || this.transferred)
      throw new Error("Particle geometry is not available");
    this.transferred = true;
    return this.geometry;
  };

  readonly dispose = (): void => {
    if (this.cancelled || this.transferred) return;
    this.cancelled = true;
    this.geometry.dispose();
  };
}
