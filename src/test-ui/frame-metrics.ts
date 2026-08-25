/**
 * Purpose: Measure bounded frame-rate statistics for development diagnostics.
 * Context: The Test UI needs stable FPS and p95 values without growing memory.
 * Responsibility: Retain recent valid frame times and summarize their distribution.
 * Boundary: DOM rendering and Three.js renderer counters live outside this file.
 */

const FRAME_SAMPLE_CAPACITY = 120;
const MILLISECONDS_PER_SECOND = 1_000;

export interface FrameMetrics {
  readonly framesPerSecond: number;
  readonly p95Milliseconds: number;
}

export class FrameMetricsSampler {
  private readonly frameTimesMilliseconds = new Float64Array(
    FRAME_SAMPLE_CAPACITY,
  );
  private sampleCount = 0;
  private nextSampleIndex = 0;

  add(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

    this.frameTimesMilliseconds[this.nextSampleIndex] =
      deltaSeconds * MILLISECONDS_PER_SECOND;
    this.nextSampleIndex = (this.nextSampleIndex + 1) % FRAME_SAMPLE_CAPACITY;
    this.sampleCount = Math.min(this.sampleCount + 1, FRAME_SAMPLE_CAPACITY);
  }

  read(): FrameMetrics | undefined {
    if (this.sampleCount === 0) return undefined;

    const samples = Array.from(
      this.frameTimesMilliseconds.subarray(0, this.sampleCount),
    );
    const totalMilliseconds = samples.reduce(
      (total, frameTime) => total + frameTime,
      0,
    );
    samples.sort((first, second) => first - second);

    const p95Index = Math.ceil(samples.length * 0.95) - 1;
    const averageMilliseconds = totalMilliseconds / samples.length;
    return {
      framesPerSecond: MILLISECONDS_PER_SECOND / averageMilliseconds,
      p95Milliseconds: samples[p95Index] ?? 0,
    };
  }
}
