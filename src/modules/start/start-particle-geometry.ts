import { BufferAttribute, type BufferGeometry } from "three";
import type { StartParticleParameters } from "./start-particle-settings";

const RANDOM_RANGE = 0x1_0000_0000;

/** Fill immutable GPU attributes once; the effect owns and disposes the geometry. */
export function writeStartParticleAttributes(
  geometry: BufferGeometry,
  parameters: Required<StartParticleParameters>,
): void {
  const positions = new Float32Array(parameters.count * 3);
  const targets = new Float32Array(parameters.count * 3);
  const roles = new Float32Array(parameters.count);
  const phases = new Float32Array(parameters.count);
  const sizes = new Float32Array(parameters.count);
  const haze = new Float32Array(parameters.count);
  const depths = new Float32Array(parameters.count);
  const ringCount = Math.floor(parameters.count * 0.3);
  const arrowCount = Math.floor(parameters.count * 0.2);
  const arrowEnd = ringCount + arrowCount * 2;
  const previewCapacity = parameters.count - arrowEnd;
  for (let index = 0; index < parameters.count; index += 1) {
    const offset = index * 3;
    // Matching samples make transfer into the retiring slot visually continuous.
    const seed =
      index >= ringCount + arrowCount && index < arrowEnd
        ? index - arrowCount
        : index;
    positions[offset] =
      (random(seed, 0) * 2 - 1) * parameters.cloudRadiusMeters;
    positions[offset + 1] =
      (random(seed, 1) * 2 - 1) * parameters.cloudRadiusMeters;
    positions[offset + 2] =
      (random(seed, 2) * 2 - 1) * parameters.cloudDepthMeters;
    phases[index] = random(seed, 3) * Math.PI * 2;
    const isHaze = random(seed, 8) < parameters.hazeFraction;
    haze[index] = isHaze ? 1 : 0;
    sizes[index] = isHaze
      ? 5 + random(seed, 9) * 4
      : 0.45 + random(seed, 9) * 1.15;
    if (index >= ringCount && index < arrowEnd) {
      roles[index] = index < ringCount + arrowCount ? 1 : 5;
      // Sample a filled shaft or triangular head, including an elliptical depth.
      const head = random(seed, 4) > 0.55;
      const x = head
        ? 0.05 + (1 - Math.sqrt(random(seed, 5))) * 0.5
        : -0.55 + random(seed, 5) * 0.65;
      const width = head ? (0.55 - x) * 0.72 : 0.11;
      const angle = random(seed, 6) * Math.PI * 2;
      const radial = Math.sqrt(random(seed, 7));
      targets[offset] = x;
      targets[offset + 1] = Math.cos(angle) * radial * width;
      targets[offset + 2] = Math.sin(angle) * radial * 0.13;
    } else {
      roles[index] =
        index < ringCount
          ? 0
          : 2 +
            Math.min(2, Math.floor(((index - arrowEnd) / previewCapacity) * 3));
      const angle = random(seed, 4) * Math.PI * 2;
      const crossAngle = random(seed, 5) * Math.PI * 2;
      // A dense core with a sparse shell; low frequency lobes soften the torus.
      const radial = random(seed, 6) ** (isHaze ? 0.45 : 0.85);
      const lobe = 0.82 + 0.18 * Math.sin(angle * 5 + Math.sin(angle * 3));
      const crossRadius = radial * lobe;
      targets[offset] = Math.cos(angle);
      targets[offset + 1] = Math.sin(angle);
      targets[offset + 2] = Math.cos(crossAngle) * crossRadius;
      depths[index] = Math.sin(crossAngle) * crossRadius;
    }
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("startTarget", new BufferAttribute(targets, 3));
  geometry.setAttribute("startRole", new BufferAttribute(roles, 1));
  geometry.setAttribute("startPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("startParticleSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("startHaze", new BufferAttribute(haze, 1));
  geometry.setAttribute("startDepth", new BufferAttribute(depths, 1));
}

function random(index: number, channel: number): number {
  let hash =
    Math.imul(index + 1, 83_492_791) ^ Math.imul(channel + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_RANGE;
}
