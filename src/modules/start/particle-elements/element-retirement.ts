import { Vector3 } from "three";
import type {
  ElementBounds,
  ElementRetirement,
  RetirementSettings,
} from "./particle-contract";

// 1. Fixed storage and explicit section retirement; no passage or rendering policy
/** Fade each retired element only while its complete bound is behind the flier. */
export function createElementRetirement(
  settings: RetirementSettings,
): ElementRetirement {
  return new Retirement(settings);
}
class Retirement implements ElementRetirement {
  readonly presence: Float32Array;
  private bounds: ElementBounds[] = [];
  private readonly relative = new Vector3();
  private readonly direction = new Vector3();
  private requested = false;
  constructor(private readonly settings: RetirementSettings) {
    this.presence = new Float32Array(settings.capacity);
  }
  readonly reset = (bounds: readonly ElementBounds[]): void => {
    if (bounds.length > this.presence.length)
      throw new RangeError("Retirement capacity exceeded");
    this.bounds = bounds.map((bound) => ({
      center: new Vector3().copy(bound.center),
      radius: bound.radius,
    }));
    this.presence.fill(1);
    this.requested = false;
  };
  readonly request = (): void => {
    this.requested = true;
  };

  // 2. Gaze never participates. Turning toward a fading ring pauses its fade.
  readonly update: ElementRetirement["update"] = (seconds, flight): void => {
    if (!this.requested || flight.direction.lengthSq() === 0) return;
    this.direction.copy(flight.direction).normalize();
    const step =
      this.settings.dissolveSeconds > 0
        ? Math.max(0, seconds) / this.settings.dissolveSeconds
        : 1;
    this.bounds.forEach((bound, index) => {
      const forward = this.relative
        .subVectors(bound.center, flight.position)
        .dot(this.direction);
      if (forward + bound.radius >= -this.settings.clearanceMeters) return;
      this.presence[index] = Math.max(0, (this.presence[index] ?? 0) - step);
    });
  };
  readonly isFinished = (): boolean =>
    this.requested &&
    this.bounds.every((_, index) => this.presence[index] === 0);
}
