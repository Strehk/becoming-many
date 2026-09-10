import type {
  ParticleLight,
  ParticleLightFrame,
  ParticleLightSettings,
} from "./particle-contract";

// 1. One bounded clock and one feedback state per displayed element
/** Shape-independent sweep and success flash; section lifetime owns visibility; Start supplies time. */
export function createParticleLight(
  settings: ParticleLightSettings,
): ParticleLight {
  return new ParticleLightTimeline(settings);
}
class ParticleLightTimeline implements ParticleLight {
  private elapsedSeconds = 0;
  private pulses: number[] = [];
  private cycles: number[] = [];
  readonly readPulses = (): readonly number[] => this.pulses;
  private passedAt: number[] = [];
  private frames: ParticleLightFrame[] = [];
  constructor(private readonly settings: ParticleLightSettings) {}

  readonly reset = (count: number): void => {
    if (!Number.isInteger(count) || count < 0 || count > this.settings.capacity)
      throw new RangeError("Element light capacity exceeded");
    this.elapsedSeconds = 0;
    this.pulses = Array(count).fill(0);
    this.cycles = Array(count).fill(-1);
    this.passedAt = Array(count).fill(Number.POSITIVE_INFINITY);
    this.frames = Array.from({ length: count }, () => ({
      head: -1,
      strength: 0,
    }));
  };
  readonly pass = (index: number): void => {
    if (this.passedAt[index] !== Number.POSITIVE_INFINITY) return;
    this.passedAt[index] = this.elapsedSeconds;
    this.pulses[index] = (this.pulses[index] ?? 0) + 1;
  };

  // 2. Idle waves repeat; a successful crossing replaces them with one final wave
  readonly update = (seconds: number): readonly ParticleLightFrame[] => {
    this.elapsedSeconds += Math.max(0, seconds);
    this.frames.forEach((frame, index) => {
      this.updateFrame(frame, index);
    });
    return this.frames;
  };
  private updatePulse(index: number): void {
    const offset =
      (index * this.settings.staggerSeconds) % this.settings.periodSeconds;
    const cycle = Math.floor(
      (this.elapsedSeconds - offset) / this.settings.periodSeconds,
    );
    if (cycle < 0 || cycle === this.cycles[index]) return;
    this.cycles[index] = cycle;
    this.pulses[index] = (this.pulses[index] ?? 0) + 1;
  }
  private updateFrame(frame: ParticleLightFrame, index: number): void {
    const settings = this.settings;
    const age = this.elapsedSeconds - (this.passedAt[index] ?? Infinity);
    const passed = age >= 0;
    if (!passed) this.updatePulse(index);
    const phase = passed
      ? age
      : (this.elapsedSeconds +
          settings.periodSeconds -
          ((index * settings.staggerSeconds) % settings.periodSeconds)) %
        settings.periodSeconds;
    const duration = passed ? settings.flashSeconds : settings.sweepSeconds;
    frame.head =
      -settings.bandWidth + (phase / duration) * (1 + 2 * settings.bandWidth);
    frame.strength = passed ? 1 : settings.guideStrength;
  }
}
