import type { AnimationSettings, ParticleAnimation } from "./particle-contract";

// 1. Shape-independent reversible envelope
/** Return presence in [0,1]; reversing a fade never jumps in opacity or scatter. */
export function createParticleAnimation(
  settings: AnimationSettings,
): ParticleAnimation {
  let presence = 0;
  let target = 0;
  return {
    reset: () => {
      presence = 0;
      target = 0;
    },
    reveal: () => {
      target = 1;
    },
    dissolve: () => {
      target = 0;
    },
    update: (seconds) => {
      const duration = target
        ? settings.revealSeconds
        : settings.dissolveSeconds;
      const step = duration > 0 ? Math.max(0, seconds) / duration : 1;
      presence +=
        Math.sign(target - presence) *
        Math.min(Math.abs(target - presence), step);
      return presence * presence * (3 - 2 * presence);
    },
    isFinished: () => target === 0 && presence === 0,
  };
}

// 2. Staggered emergence reuses the same smooth envelope for every shape.
interface RevealSettings {
  readonly capacity: number;
  readonly fadeSeconds: number;
  readonly speedMetersPerSecond: number;
}
export function createElementReveal(
  settings: RevealSettings,
): import("./particle-contract").ElementReveal {
  return new ElementRevealTimeline(settings);
}

class ElementRevealTimeline {
  readonly presence: Float32Array;
  private readonly elapsed: Float32Array;
  private distances: readonly number[] = [];
  private time = 0;
  private origin = 0;
  private cancelled = false;
  constructor(private readonly settings: RevealSettings) {
    if (
      !Number.isInteger(settings.capacity) ||
      settings.capacity < 1 ||
      !Number.isFinite(settings.fadeSeconds) ||
      settings.fadeSeconds <= 0 ||
      !Number.isFinite(settings.speedMetersPerSecond) ||
      settings.speedMetersPerSecond <= 0
    )
      throw new RangeError("Invalid element reveal settings");
    this.presence = new Float32Array(settings.capacity);
    this.elapsed = new Float32Array(settings.capacity);
  }
  readonly reset = (next: readonly number[]): void => {
    if (next.length > this.settings.capacity)
      throw new RangeError("Reveal capacity exceeded");
    this.distances = [...next];
    this.origin = Math.min(...next);
    this.time = 0;
    this.cancelled = false;
    this.presence.fill(0);
    this.elapsed.fill(0);
  };
  readonly update = (seconds: number, frontMeters: number): void => {
    if (this.cancelled) return;
    this.time += Math.max(0, seconds);
    this.distances.forEach((distance, index) => {
      if (
        frontMeters < distance ||
        this.time <
          (distance - this.origin) / this.settings.speedMetersPerSecond
      )
        return;
      this.elapsed[index] = (this.elapsed[index] ?? 0) + Math.max(0, seconds);
      const t = Math.min(
        1,
        (this.elapsed[index] ?? 0) / this.settings.fadeSeconds,
      );
      this.presence[index] = t * t * (3 - 2 * t);
    });
  };
  readonly cancel = (): void => {
    this.cancelled = true;
  };
}
