import { Vector3 } from "three";
import type { RingPassage, RingTarget } from "./particle-contract";

// 1. World-space movement only: no camera, rendering or exercise progression
/** Detect swept forward crossings inside openings; discontinuous movement is ignored. */
export function createRingPassage(
  maximumStepMeters: number,
  paddingMeters = 0,
): RingPassage {
  return new RingPassageObserver(maximumStepMeters, paddingMeters);
}
class RingPassageObserver implements RingPassage {
  private rings: RingTarget[] = [];
  private readonly previous = new Vector3();
  private readonly relative = new Vector3();
  private readonly crossing = new Vector3();
  private readonly passed = new Set<number>();
  private readonly events: number[] = [];
  constructor(
    private readonly maximumStepMeters: number,
    private readonly paddingMeters: number,
  ) {}

  readonly readPassed = (count: number): boolean => {
    if (count <= 0 || this.rings.length < count) return false;
    for (let index = 0; index < count; index++) {
      const ring = this.rings[index];
      if (!ring || !this.passed.has(ring.elementIndex)) return false;
    }
    return true;
  };

  readonly reset = (
    rings: readonly RingTarget[],
    player: Readonly<Vector3>,
  ): void => {
    this.rings = rings.map((ring) => ({
      ...ring,
      center: new Vector3().copy(ring.center),
      direction: new Vector3().copy(ring.direction).normalize(),
    }));
    this.previous.copy(player);
    this.passed.clear();
    this.events.length = 0;
  };
  readonly update = (player: Readonly<Vector3>): readonly number[] => {
    this.events.length = 0;
    if (this.previous.distanceTo(player) <= this.maximumStepMeters) {
      for (const ring of this.rings) {
        if (this.passed.has(ring.elementIndex) || !this.crosses(ring, player))
          continue;
        this.passed.add(ring.elementIndex);
        this.events.push(ring.elementIndex);
      }
    }
    this.previous.copy(player);
    return this.events;
  };

  // 2. Intersect the motion segment with the ring plane, then test the clear radius
  private crosses(ring: RingTarget, player: Readonly<Vector3>): boolean {
    const before = this.relative
      .subVectors(this.previous, ring.center)
      .dot(ring.direction);
    const after = this.relative
      .subVectors(player, ring.center)
      .dot(ring.direction);
    if (before >= 0 || after < 0) return false;
    this.crossing.lerpVectors(
      this.previous,
      player,
      -before / (after - before),
    );
    return (
      this.crossing.distanceToSquared(ring.center) <=
      (ring.radiusMeters + this.paddingMeters) ** 2
    );
  }
}
