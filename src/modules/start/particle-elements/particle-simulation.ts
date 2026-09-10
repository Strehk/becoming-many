import { Line3, Vector3 } from "three";
import type {
  ParticleSimulation,
  SimulationSettings,
} from "./particle-contract";

// 1. Bounded spring response to the swept flight position; no gaze or route input
export function createParticleSimulation(
  settings: SimulationSettings,
): ParticleSimulation {
  return new Simulation(settings);
}
class Simulation implements ParticleSimulation {
  private targets: Float32Array = new Float32Array(0);
  private offsets = new Float32Array(0);
  private velocities = new Float32Array(0);
  private active = new Uint8Array(0);
  private damping = 1;
  private hasImpulse = false;
  private previous: Vector3 | undefined;
  private readonly segment = new Line3();
  private readonly movement = new Vector3();
  private readonly particle = new Vector3();
  private readonly nearest = new Vector3();
  constructor(private readonly settings: SimulationSettings) {}

  readonly reset = (targets: Float32Array): void => {
    this.targets = targets;
    this.offsets = new Float32Array(targets.length);
    this.velocities = new Float32Array(targets.length);
    this.active = new Uint8Array(targets.length / 3);
    this.previous = undefined;
  };

  readonly update = (
    seconds: number,
    player: Readonly<Vector3>,
  ): Float32Array => {
    const dt = Math.min(
      Math.max(0, seconds),
      this.settings.maximumDeltaSeconds,
    );
    this.segment.start.copy(this.previous ?? player);
    this.segment.end.copy(player);
    this.movement.subVectors(player, this.segment.start);
    if (this.movement.length() > this.settings.maximumStepMeters || dt === 0)
      this.movement.set(0, 0, 0);
    this.hasImpulse = this.movement.lengthSq() > 0;
    this.damping = Math.exp(-this.settings.damping * dt);
    this.previous ??= new Vector3();
    this.previous.copy(player);
    for (let index = 0; index < this.targets.length; index += 3)
      this.updateParticle(index, dt);
    return this.offsets;
  };

  // 2. Flight impulse and damped return; fixed buffers, no per-particle allocations
  private updateParticle(index: number, dt: number): void {
    const particleIndex = index / 3;
    if (!this.hasImpulse && !this.active[particleIndex]) return;
    const influence = this.hasImpulse ? this.sampleInfluence(index) : 0;
    if (influence === 0 && !this.active[particleIndex]) return;
    this.active[particleIndex] = 1;
    for (let axis = 0; axis < 3; axis++) {
      const i = index + axis;
      const impulse =
        this.movement.getComponent(axis) * influence * this.settings.impulse;
      const velocity =
        ((this.velocities[i] ?? 0) +
          impulse -
          (this.offsets[i] ?? 0) * this.settings.spring * dt) *
        this.damping;
      this.velocities[i] = velocity;
      this.offsets[i] = Math.max(
        -this.settings.maximumOffsetMeters,
        Math.min(
          this.settings.maximumOffsetMeters,
          (this.offsets[i] ?? 0) + velocity * dt,
        ),
      );
    }
  }
  private sampleInfluence(index: number): number {
    this.particle.fromArray(this.targets, index);
    this.segment.closestPointToPoint(this.particle, true, this.nearest);
    return Math.max(
      0,
      1 - this.particle.distanceTo(this.nearest) / this.settings.radiusMeters,
    );
  }
}
