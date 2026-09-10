import { Vector3 } from "three";
import type {
  ElementBounds,
  ElementRetirement,
  ElementRetirementMode,
  RetirementSettings,
} from "./particle-contract";

// 1. Fixed storage and explicit section retirement; no passage or rendering policy
/** Completed routes retire behind the flier; an abandoned route fades on one timeline. */
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
  private mode: ElementRetirementMode | undefined;
  private remainingSeconds = 0;
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
    this.mode = undefined;
    this.remainingSeconds = 0;
  };
  readonly request: ElementRetirement["request"] = (
    mode = "completed",
    durationSeconds = this.settings.dissolveSeconds,
  ): void => {
    if (this.mode === "abandoned") return;
    this.mode = mode;
    this.remainingSeconds = Math.max(0, durationSeconds);
  };

  // 2. Gaze never participates. Turning toward a fading ring pauses its fade.
  readonly update: ElementRetirement["update"] = (seconds, flight): void => {
    if (this.mode === "abandoned") {
      this.fadeCourse(seconds);
      return;
    }
    if (!this.mode || flight.direction.lengthSq() === 0) return;
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
  // Whole-course cancellation shares its duration with the line display.
  private fadeCourse(seconds: number): void {
    const step = Math.min(Math.max(0, seconds), this.remainingSeconds);
    const factor =
      this.remainingSeconds > 0 ? 1 - step / this.remainingSeconds : 0;
    this.presence.forEach((presence, index) => {
      this.presence[index] = presence * factor;
    });
    this.remainingSeconds -= step;
  }
  readonly isFinished = (): boolean =>
    this.mode !== undefined &&
    this.bounds.every((_, index) => this.presence[index] === 0);
}
