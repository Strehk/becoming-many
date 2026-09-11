/** Active tutorial seconds begin with audible narration, not asset loading. */
export class StartTiming {
  private started = false;
  private elapsedSeconds = 0;

  constructor(
    private readonly settings: {
      maximumExerciseSeconds: number;
      voiceSafetySeconds: number;
    },
  ) {}

  reset(): void {
    this.started = false;
    this.elapsedSeconds = 0;
  }

  update(deltaSeconds: number, voiceOffsetSeconds: number): void {
    this.started ||= voiceOffsetSeconds > 0;
    if (this.started && Number.isFinite(deltaSeconds))
      this.elapsedSeconds += Math.max(0, deltaSeconds);
  }

  /** Do not start a recording that would have to be cut off at the deadline. */
  canPlay(durationSeconds: number): boolean {
    return (
      this.elapsedSeconds + durationSeconds + this.settings.voiceSafetySeconds <
      this.settings.maximumExerciseSeconds
    );
  }

  expired(): boolean {
    return this.elapsedSeconds >= this.settings.maximumExerciseSeconds;
  }
}
