/**
 * Purpose: Summarize recorded benchmark frames into one comparable report.
 * Context: Counters gate regressions; frame times only trend on a real GPU.
 * Responsibility: Separate exact counter facts from statistical timing values.
 * Boundary: Frame recording, rendering, and baseline comparison stay outside.
 */

/** One measured frame, recorded after its render call completed. */
export interface BenchmarkFrameSample {
  /** Wall time between this frame callback and the previous one. */
  readonly frameMilliseconds: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly streamQueueSize: number;
}

/**
 * Exact integers produced by renderer.info. A deterministic route makes these
 * identical across machines, so they can gate a pull request.
 */
export interface BenchmarkCounters {
  readonly maxDrawCalls: number;
  readonly maxTriangles: number;
  readonly maxGeometries: number;
  readonly maxTextures: number;
  readonly maxPrograms: number;
}

/** Noisy measurements. Only comparable against a run on the same machine. */
export interface BenchmarkTiming {
  readonly medianMilliseconds: number;
  readonly p95Milliseconds: number;
  readonly p99Milliseconds: number;
  readonly maxMilliseconds: number;
  readonly missedFrames: number;
  readonly longestMissedRunFrames: number;
}

/** Deterministic streaming facts measured in frames, never in seconds. */
export interface BenchmarkStreaming {
  readonly maxQueueSize: number;
  /** Frames until the queue stayed empty; -1 while it never drained. */
  readonly framesUntilDrained: number;
}

export interface BenchmarkReport {
  readonly levelName: string;
  readonly profileName: string;
  readonly frames: number;
  readonly counters: BenchmarkCounters;
  readonly timing: BenchmarkTiming;
  readonly streaming: BenchmarkStreaming;
}

export function summarizeBenchmark(
  levelName: string,
  profileName: string,
  samples: readonly BenchmarkFrameSample[],
  frameBudgetMilliseconds: number,
): BenchmarkReport {
  return {
    levelName,
    profileName,
    frames: samples.length,
    counters: summarizeCounters(samples),
    timing: summarizeTiming(samples, frameBudgetMilliseconds),
    streaming: summarizeStreaming(samples),
  };
}

function summarizeCounters(
  samples: readonly BenchmarkFrameSample[],
): BenchmarkCounters {
  return {
    maxDrawCalls: maxOf(samples, (sample) => sample.drawCalls),
    maxTriangles: maxOf(samples, (sample) => sample.triangles),
    maxGeometries: maxOf(samples, (sample) => sample.geometries),
    maxTextures: maxOf(samples, (sample) => sample.textures),
    maxPrograms: maxOf(samples, (sample) => sample.programs),
  };
}

function summarizeTiming(
  samples: readonly BenchmarkFrameSample[],
  frameBudgetMilliseconds: number,
): BenchmarkTiming {
  const sorted = samples
    .map((sample) => sample.frameMilliseconds)
    .sort((first, second) => first - second);

  return {
    medianMilliseconds: percentile(sorted, 0.5),
    p95Milliseconds: percentile(sorted, 0.95),
    p99Milliseconds: percentile(sorted, 0.99),
    maxMilliseconds: sorted.at(-1) ?? 0,
    missedFrames: countMissed(samples, frameBudgetMilliseconds),
    longestMissedRunFrames: longestMissedRun(samples, frameBudgetMilliseconds),
  };
}

function summarizeStreaming(
  samples: readonly BenchmarkFrameSample[],
): BenchmarkStreaming {
  const lastBusy = samples.findLastIndex(
    (sample) => sample.streamQueueSize > 0,
  );
  return {
    maxQueueSize: maxOf(samples, (sample) => sample.streamQueueSize),
    framesUntilDrained: lastBusy === samples.length - 1 ? -1 : lastBusy + 1,
  };
}

function countMissed(
  samples: readonly BenchmarkFrameSample[],
  budgetMilliseconds: number,
): number {
  return samples.filter(
    (sample) => sample.frameMilliseconds > budgetMilliseconds,
  ).length;
}

/** A single long spike reads differently from many consecutive dropped frames. */
function longestMissedRun(
  samples: readonly BenchmarkFrameSample[],
  budgetMilliseconds: number,
): number {
  let longest = 0;
  let current = 0;

  for (const sample of samples) {
    current = sample.frameMilliseconds > budgetMilliseconds ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index] ?? 0;
}

function maxOf(
  samples: readonly BenchmarkFrameSample[],
  read: (sample: BenchmarkFrameSample) => number,
): number {
  let highest = 0;
  for (const sample of samples) highest = Math.max(highest, read(sample));
  return highest;
}
