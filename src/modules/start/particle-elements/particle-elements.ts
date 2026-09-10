import {
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Points,
  Quaternion,
  type Scene,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PathParticleMaterial } from "../flight-path/particle-contract";
import type { ExercisePose } from "../start-contract";
import type {
  AnimationSettings,
  ElementGeometryFactory,
  ElementSource,
  ParticleAnimation,
  ParticleSimulation,
} from "./particle-contract";

// 1. Display contract: all concrete collaborators are supplied by Start
const UP = new Vector3(0, 1, 0);
const LOCAL_FORWARD = new Vector3(1, 0, 0);
const SCATTER_PHASE = 12.9898;
const MAXIMUM_PARTICLES = 20_000;
const MAXIMUM_GRAINS_PER_SAMPLE = 16;
interface ElementOptions {
  readonly scene: Scene;
  readonly grainsPerSample: number;
  readonly belowFlightMeters: number;
  readonly animationSettings: AnimationSettings;
  readonly animation: ParticleAnimation;
  readonly simulation: ParticleSimulation;
  readonly readPosition: () => Readonly<Vector3>;
  readonly createGeometry: ElementGeometryFactory;
  readonly createMaterial: () => PathParticleMaterial;
}

/** Own one combined cloud per section; lifecycle and frame clock belong to Start. */
export function createParticleElements(options: ElementOptions) {
  return new ParticleElements(options);
}
class ParticleElements {
  private cloud: Points | undefined;
  private material: PathParticleMaterial | undefined;
  private targets: Float32Array = new Float32Array(0);
  private scatter = new Float32Array(0);
  constructor(private readonly options: ElementOptions) {
    if (
      !Number.isInteger(options.grainsPerSample) ||
      options.grainsPerSample < 1 ||
      options.grainsPerSample > MAXIMUM_GRAINS_PER_SAMPLE
    )
      throw new RangeError("Invalid grain budget");
  }

  // 2. Resource lifetime: one material and one draw call for all section elements
  readonly load = (): void => {
    if (this.cloud) return;
    this.material = this.options.createMaterial();
    this.cloud = new Points(new BufferGeometry(), this.material.pointsMaterial);
    this.cloud.name = "StartParticleElements";
    this.cloud.visible = false;
    // Wind, emergence scatter and spring displacement extend static shape bounds.
    this.cloud.frustumCulled = false;
  };
  readonly activate = (): void => {
    this.deactivate();
  };
  readonly deactivate = (): void => {
    this.options.animation.reset();
    if (this.cloud) this.cloud.visible = false;
    this.cloud?.removeFromParent();
  };
  readonly unload = (): void => {
    this.deactivate();
    this.cloud?.geometry.dispose();
    this.material?.pointsMaterial.dispose();
    this.cloud = undefined;
    this.material = undefined;
    this.targets = new Float32Array(0);
    this.scatter = new Float32Array(0);
    this.options.simulation.reset(this.targets);
  };

  // 3. Shape sampling and fixed world placement, with explicit geometry ownership
  readonly show = (
    sources: readonly ElementSource[],
    pose: ExercisePose,
  ): void => {
    if (!this.cloud)
      throw new Error("Load particle elements before showing them");
    if (sources.length === 0) {
      this.deactivate();
      return;
    }
    const geometry = this.createGeometry(sources, pose);
    this.cloud.geometry.dispose();
    this.cloud.geometry = geometry;
    this.targets = new Float32Array(
      geometry.getAttribute("elementCenter").array,
    );
    this.scatter = this.targets.map(
      (_, index) =>
        Math.sin(index * SCATTER_PHASE) *
        this.options.animationSettings.scatterMeters,
    );
    this.options.simulation.reset(this.targets);
    this.options.animation.reveal();
    if (this.material) this.material.pointsMaterial.opacity = 0;
    this.cloud.visible = true;
    this.options.scene.add(this.cloud);
  };

  private createGeometry(
    sources: readonly ElementSource[],
    pose: ExercisePose,
  ): BufferGeometry {
    const parts: BufferGeometry[] = [];
    try {
      for (const source of sources)
        parts.push(this.placeGeometry(source, pose));
      const count = parts.reduce(
        (sum, part) => sum + part.getAttribute("position").count,
        0,
      );
      if (count > MAXIMUM_PARTICLES)
        throw new RangeError("Element particle budget exceeded");
      const geometry = mergeGeometries(parts);
      if (!geometry)
        throw new Error("Incompatible element particle attributes");
      try {
        return this.createGrains(geometry);
      } finally {
        geometry.dispose();
      }
    } finally {
      for (const part of parts) part.dispose();
    }
  }

  private createGrains(source: BufferGeometry): InstancedBufferGeometry {
    const geometry = new InstancedBufferGeometry();
    const count = source.getAttribute("position").count;
    geometry.instanceCount = this.options.grainsPerSample;
    geometry.setAttribute("position", new Float32BufferAttribute(count * 3, 3));
    const indices = new Float32Array(this.options.grainsPerSample);
    for (let index = 0; index < indices.length; index++) indices[index] = index;
    geometry.setAttribute(
      "grainIndex",
      new InstancedBufferAttribute(indices, 1),
    );
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const instance = new Float32BufferAttribute(
        new Float32Array(attribute.array),
        attribute.itemSize,
      );
      if (name === "position") instance.setUsage(DynamicDrawUsage);
      geometry.setAttribute(
        name === "position" ? "elementCenter" : name,
        instance,
      );
    }
    return geometry;
  }

  private placeGeometry(
    source: ElementSource,
    pose: ExercisePose,
  ): BufferGeometry {
    const geometry = this.options.createGeometry(source.shape);
    const { placement } = source;
    geometry.applyQuaternion(
      new Quaternion().setFromUnitVectors(LOCAL_FORWARD, placement.direction),
    );
    geometry.translate(
      placement.position.x,
      placement.position.y,
      placement.position.z,
    );
    geometry.applyQuaternion(
      new Quaternion().setFromAxisAngle(UP, pose.yawRadians),
    );
    geometry.translate(
      pose.position.x,
      pose.position.y - this.options.belowFlightMeters,
      pose.position.z,
    );
    return geometry;
  }

  // 4. Shared emergence/dissolve envelope plus shape-independent flight disturbance
  readonly dissolve = (): void => {
    this.options.animation.dissolve();
  };
  readonly update = (seconds: number): void => {
    if (!this.cloud?.visible || !this.material) return;
    const presence = this.options.animation.update(seconds);
    this.material.pointsMaterial.opacity = presence;
    this.material.update(seconds);
    const offsets = this.options.simulation.update(
      seconds,
      this.options.readPosition(),
    );
    const attribute = this.cloud.geometry.getAttribute("elementCenter");
    const positions = attribute.array;
    for (let index = 0; index < positions.length; index++) {
      positions[index] =
        (this.targets[index] ?? 0) +
        (offsets[index] ?? 0) +
        (this.scatter[index] ?? 0) * (1 - presence);
    }
    attribute.needsUpdate = true;
    if (this.options.animation.isFinished()) this.deactivate();
  };
}
