/**
 * Purpose: Verify bounded frame statistics used by the Test UI.
 * Context: FPS and p95 must remain deterministic without unbounded sample history.
 * Responsibility: Cover calculation, input rejection, and rolling-window capacity.
 * Boundary: DOM rendering and Three.js counters are verified in the browser.
 */

import { expect, test } from "bun:test";
import { FrameMetricsSampler } from "../../src/test-ui/frame-metrics";

test("calculates FPS and p95 from recent frame times", () => {
  const sampler = new FrameMetricsSampler();
  sampler.add(0.01);
  sampler.add(0.02);

  expect(sampler.read()?.framesPerSecond).toBeCloseTo(66.67, 2);
  expect(sampler.read()?.p95Milliseconds).toBe(20);
});

test("ignores invalid frame times", () => {
  const sampler = new FrameMetricsSampler();
  sampler.add(0);
  sampler.add(-0.01);
  sampler.add(Number.NaN);
  sampler.add(Number.POSITIVE_INFINITY);

  expect(sampler.read()).toBeUndefined();
});

test("retains only the latest 120 frame times", () => {
  const sampler = new FrameMetricsSampler();
  sampler.add(1);

  for (let sampleIndex = 0; sampleIndex < 120; sampleIndex += 1) {
    sampler.add(0.01);
  }

  expect(sampler.read()?.framesPerSecond).toBeCloseTo(100);
  expect(sampler.read()?.p95Milliseconds).toBe(10);
});
