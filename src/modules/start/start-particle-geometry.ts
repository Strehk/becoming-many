import { BufferAttribute, type BufferGeometry } from "three";
import type { StartParticleParameters } from "./start-particle-settings";

const RANDOM_RANGE = 0x1_0000_0000;

/** Fill immutable GPU attributes once; the effect owns and disposes the geometry. */
export function writeStartParticleAttributes(
  geometry: BufferGeometry,
  parameters: Required<StartParticleParameters>,
): void {
  const samples = new ParticleSamples(parameters);
  for (let index = 0; index < parameters.count; index += 1)
    samples.write(index);
  for (const [name, attribute] of Object.entries(samples.attributes))
    geometry.setAttribute(name, attribute);
}

class ParticleSamples {
  readonly attributes;
  private readonly ringCount: number;
  private readonly arrowCount: number;
  private readonly arrowEnd: number;

  constructor(private readonly parameters: Required<StartParticleParameters>) {
    this.ringCount = Math.floor(parameters.count * 0.3);
    this.arrowCount = Math.floor(parameters.count * 0.2);
    this.arrowEnd = this.ringCount + this.arrowCount * 2;
    const count = parameters.count;
    this.attributes = {
      position: createAttribute(count, 3),
      startTarget: createAttribute(count, 3),
      startRole: createAttribute(count),
      startPhase: createAttribute(count),
      startParticleSize: createAttribute(count),
      startHaze: createAttribute(count),
      startDepth: createAttribute(count),
    };
  }

  write(index: number): void {
    // Matching samples make transfer into the retiring slot visually continuous.
    const seed =
      index >= this.ringCount + this.arrowCount && index < this.arrowEnd
        ? index - this.arrowCount
        : index;
    const { attributes } = this;
    const parameters = this.parameters;
    const isHaze = this.writeCloud(index, seed);
    if (index >= this.ringCount && index < this.arrowEnd) {
      attributes.startRole.setX(
        index,
        index < this.ringCount + this.arrowCount ? 1 : 5,
      );
      this.writeArrow(index, seed);
      return;
    }
    const preview =
      (index - this.arrowEnd) / (parameters.count - this.arrowEnd);
    const role =
      index < this.ringCount ? 0 : 2 + Math.min(2, Math.floor(preview * 3));
    attributes.startRole.setX(index, role);
    this.writeRing(index, seed, isHaze);
  }

  private writeCloud(index: number, seed: number): boolean {
    const { attributes } = this;
    const parameters = this.parameters;
    attributes.position.setXYZ(
      index,
      (random(seed, 0) * 2 - 1) * parameters.cloudRadiusMeters,
      (random(seed, 1) * 2 - 1) * parameters.cloudRadiusMeters,
      (random(seed, 2) * 2 - 1) * parameters.cloudDepthMeters,
    );
    attributes.startPhase.setX(index, random(seed, 3) * Math.PI * 2);
    const isHaze = random(seed, 8) < parameters.hazeFraction;
    attributes.startHaze.setX(index, Number(isHaze));
    attributes.startParticleSize.setX(
      index,
      isHaze ? 5 + random(seed, 9) * 4 : 0.45 + random(seed, 9) * 1.15,
    );
    return isHaze;
  }

  private writeArrow(index: number, seed: number): void {
    // Sample a filled shaft or triangular head, including an elliptical depth.
    const head = random(seed, 4) > 0.55;
    const x = head
      ? 0.05 + (1 - Math.sqrt(random(seed, 5))) * 0.5
      : -0.55 + random(seed, 5) * 0.65;
    const width = head ? (0.55 - x) * 0.72 : 0.11;
    const angle = random(seed, 6) * Math.PI * 2;
    const radial = Math.sqrt(random(seed, 7));
    this.attributes.startTarget.setXYZ(
      index,
      x,
      Math.cos(angle) * radial * width,
      Math.sin(angle) * radial * 0.13,
    );
  }

  private writeRing(index: number, seed: number, isHaze: boolean): void {
    const angle = random(seed, 4) * Math.PI * 2;
    const crossAngle = random(seed, 5) * Math.PI * 2;
    // A dense core with a sparse shell; low frequency lobes soften the torus.
    const radial = random(seed, 6) ** (isHaze ? 0.45 : 0.85);
    const lobe = 0.82 + 0.18 * Math.sin(angle * 5 + Math.sin(angle * 3));
    const crossRadius = radial * lobe;
    this.attributes.startTarget.setXYZ(
      index,
      Math.cos(angle),
      Math.sin(angle),
      Math.cos(crossAngle) * crossRadius,
    );
    this.attributes.startDepth.setX(index, Math.sin(crossAngle) * crossRadius);
  }
}

function random(index: number, channel: number): number {
  let hash =
    Math.imul(index + 1, 83_492_791) ^ Math.imul(channel + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_RANGE;
}

function createAttribute(count: number, width = 1): BufferAttribute {
  return new BufferAttribute(new Float32Array(count * width), width);
}
