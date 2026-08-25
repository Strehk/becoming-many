/**
 * Purpose: Spread procedural streaming work across bounded frame-time slices.
 * Context: Several loaded modules may need to prepare content while rendering stays smooth.
 * Responsibility: Deduplicate, validate, and advance small cooperative stream jobs.
 * Boundary: Modules define the work; this queue knows nothing about chunks or Three.js.
 */

export interface StreamJob {
  /** Stable keys replace older pending work for the same module resource slot. */
  readonly key: object;

  /** Lower values run first when later content depends on foundational work. */
  readonly priority?: number;

  /** Obsolete jobs are removed before they can mutate recycled resources. */
  readonly isCurrent: () => boolean;

  /** Perform one small unit of work and return true when the job is complete. */
  readonly runStep: () => boolean;
}

export interface StreamQueueOptions {
  readonly budgetMilliseconds: number;
  readonly capacity: number;
}

type ReadTime = () => number;

const DEFAULT_STREAM_PRIORITY = 1;

/** Terrain must publish recycled support before dependent content appears. */
export const SURFACE_STREAM_PRIORITY = 0;

/**
 * The queue is shared by all streamed modules and advanced once per frame.
 * Every job runs at most one step per update, which prevents one long-running
 * generator from starving the rest. A step may finish or return to the queue
 * for the next frame.
 *
 * The deadline is checked between steps. Modules must therefore keep each
 * step small: the queue can prevent more work from starting, but it cannot
 * interrupt JavaScript that is already running.
 */
export class StreamQueue {
  private readonly jobs: StreamJob[] = [];

  constructor(
    private readonly options: StreamQueueOptions,
    private readonly readTime: ReadTime = () => performance.now(),
  ) {}

  get size(): number {
    return this.jobs.length;
  }

  /**
   * Add new work without allowing duplicate work for the same fixed slot.
   * Returns false only when the configured memory guard is already full.
   */
  enqueue(job: StreamJob): boolean {
    this.removeObsoleteJobs();

    const existingIndex = this.jobs.findIndex(({ key }) => key === job.key);
    if (existingIndex >= 0) {
      this.jobs[existingIndex] = job;
      return true;
    }

    if (this.jobs.length >= this.options.capacity) return false;

    this.jobs.push(job);
    return true;
  }

  /** Advance each currently queued job at most once within this frame budget. */
  update(): void {
    this.removeObsoleteJobs();
    if (this.jobs.length === 0) return;

    const deadline = this.readTime() + this.options.budgetMilliseconds;
    const jobsAtFrameStart = this.jobs.length;
    const activePriority = getHighestPriority(this.jobs);

    for (let index = 0; index < jobsAtFrameStart; index += 1) {
      if (this.readTime() >= deadline) return;

      const job = this.jobs.shift();
      if (!job?.isCurrent()) continue;
      if (getJobPriority(job) !== activePriority) {
        this.jobs.push(job);
        continue;
      }

      const completed = job.runStep();
      if (!completed && job.isCurrent()) this.jobs.push(job);
    }
  }

  private removeObsoleteJobs(): void {
    for (let index = this.jobs.length - 1; index >= 0; index -= 1) {
      if (!this.jobs[index]?.isCurrent()) this.jobs.splice(index, 1);
    }
  }
}

function getHighestPriority(jobs: readonly StreamJob[]): number {
  return Math.min(...jobs.map(getJobPriority));
}

function getJobPriority(job: StreamJob): number {
  return job.priority ?? DEFAULT_STREAM_PRIORITY;
}
