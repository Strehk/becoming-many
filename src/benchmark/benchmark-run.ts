/**
 * Purpose: Replay one fixed route and record what every rendered frame cost.
 * Context: Live controls and a wall clock make two runs incomparable.
 * Responsibility: Own the frame index, camera placement, sampling, and result.
 * Boundary: Route maths, summarizing, and level composition live elsewhere.
 */

import { MathUtils, type PerspectiveCamera } from "three";
import type { WorldFrame } from "../world/world-runtime";
import { WORLD_RUNTIME_SETTINGS } from "../world/world-settings";
import type { BenchmarkFrameSample, BenchmarkReport } from "./benchmark-report";
import { summarizeBenchmark } from "./benchmark-report";
import { cameraPoseAt, routeDurationSeconds } from "./benchmark-route";
import {
  BENCHMARK_SETTINGS,
  type BenchmarkProfileName,
} from "./benchmark-settings";

declare global {
  interface Window {
    /**
     * Automation handoff. The runner waits for this to appear; it is the
     * finished result, never state the running application reads back.
     */
    benchmarkReport?: BenchmarkReport;

    /** Frames completed out of the total, so a long run can report progress. */
    benchmarkProgress?: {
      readonly frames: number;
      readonly totalFrames: number;
    };
  }
}

export interface BenchmarkRun {
  /** Fixed timestep replacing the wall clock, so frames drive world state. */
  readonly fixedDeltaSeconds: number;
  /** Virtual clock making stream-queue work per frame frame-driven too. */
  readonly readStreamTimeMilliseconds: () => number;
  /** Places the camera for the frame about to render. */
  readonly placeCamera: (camera: PerspectiveCamera) => void;
  /** Records a finished frame. Returns false once the route is complete. */
  readonly afterFrame: (frame: WorldFrame) => boolean;
}

/**
 * Total frames a profile replays, warmup included. A run reports progress
 * against it, and a caller knows it before the browser opens the level.
 */
export function benchmarkFrameCount(profileName: BenchmarkProfileName): number {
  const { fixedDeltaSeconds } = BENCHMARK_SETTINGS.profiles[profileName];
  return BENCHMARK_SETTINGS.warmupFrames + sampleFrameCount(fixedDeltaSeconds);
}

function sampleFrameCount(fixedDeltaSeconds: number): number {
  return Math.ceil(
    routeDurationSeconds(BENCHMARK_SETTINGS.route) / fixedDeltaSeconds,
  );
}

export function createBenchmarkRun(
  levelName: string,
  profileName: BenchmarkProfileName,
): BenchmarkRun {
  const { fixedDeltaSeconds } = BENCHMARK_SETTINGS.profiles[profileName];
  const { warmupFrames, route, frameBudgetMilliseconds, streamStepsPerFrame } =
    BENCHMARK_SETTINGS;
  const sampleFrames = sampleFrameCount(fixedDeltaSeconds);

  const samples: BenchmarkFrameSample[] = [];
  let frameIndex = 0;
  let previousTimeMilliseconds = 0;

  // The queue reads this clock once per step and stops at its budget, so a
  // fixed cost per read turns the wall-clock deadline into a step count.
  const streamStepMilliseconds =
    WORLD_RUNTIME_SETTINGS.streamQueue.budgetMilliseconds / streamStepsPerFrame;
  let streamTimeMilliseconds = 0;

  return {
    fixedDeltaSeconds,

    readStreamTimeMilliseconds(): number {
      const now = streamTimeMilliseconds;
      streamTimeMilliseconds += streamStepMilliseconds;
      return now;
    },

    placeCamera(camera): void {
      // Hold the first waypoint through warmup so streaming settles before the
      // route starts, then advance route time from the frame index alone.
      const routeSeconds =
        Math.max(0, frameIndex - warmupFrames) * fixedDeltaSeconds;
      const pose = cameraPoseAt(route, routeSeconds);

      camera.position.set(...pose.positionMeters);
      camera.rotation.order = "YXZ";
      camera.rotation.set(
        MathUtils.degToRad(pose.pitchDegrees),
        MathUtils.degToRad(pose.yawDegrees),
        0,
      );
    },

    afterFrame(frame): boolean {
      const frameMilliseconds =
        frame.timeMilliseconds - previousTimeMilliseconds;
      previousTimeMilliseconds = frame.timeMilliseconds;
      frameIndex += 1;
      window.benchmarkProgress = {
        frames: frameIndex,
        totalFrames: warmupFrames + sampleFrames,
      };

      if (frameIndex <= warmupFrames) return true;

      // renderer.info.render resets on the next render call, so these counters
      // still describe the frame that just finished.
      const { render, memory, programs } = frame.renderer.info;
      samples.push({
        frameMilliseconds,
        drawCalls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        programs: programs?.length ?? 0,
        streamQueueSize: frame.streamQueue.size,
      });

      if (samples.length < sampleFrames) return true;

      window.benchmarkReport = summarizeBenchmark(
        levelName,
        profileName,
        samples,
        frameBudgetMilliseconds,
      );
      return false;
    },
  };
}
