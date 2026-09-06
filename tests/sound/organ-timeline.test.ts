/**
 * Purpose: Verify how show time reaches the organ's grids as audio time.
 * Context: The show clock is the authority; the organ has no transport. A
 *   step's audio time is the audio clock now plus its show-time distance,
 *   divided by the rate the show runs at.
 * Responsibility: Cover the mapping, the hold, the rate, and a lane asleep.
 * Boundary: The audio clock is injected; nothing here touches Tone.
 */

import { describe, expect, test } from "bun:test";
import { createOrganTimeline } from "../../src/sound/drone-organ/organ-timeline";

interface Fired {
  readonly index: number;
  readonly audioTime: number;
}

function record(): { fired: Fired[]; fire: (i: number, t: number) => void } {
  const fired: Fired[] = [];
  return {
    fired,
    fire: (index, audioTime) => fired.push({ index, audioTime }),
  };
}

describe("createOrganTimeline", () => {
  test("places a step ahead of the audio clock by its show-time distance", () => {
    const timeline = createOrganTimeline(() => 100, 0.15);
    const { fired, fire } = record();
    timeline.createLane().addSteps(1, fire);

    timeline.follow({ showTimeSeconds: 4.9, isPlaying: true, timeScale: 1 });
    expect(fired).toEqual([{ index: 5, audioTime: 100.1 }]);
  });

  test("squeezes the distance when the show runs faster", () => {
    const timeline = createOrganTimeline(() => 100, 0.2);
    const { fired, fire } = record();
    timeline.createLane().addSteps(1, fire);

    timeline.follow({ showTimeSeconds: 4.9, isPlaying: true, timeScale: 2 });
    expect(fired[0]?.audioTime).toBeCloseTo(100.05, 9);
  });

  test("places nothing while the show is held", () => {
    const timeline = createOrganTimeline(() => 0);
    const { fired, fire } = record();
    timeline.createLane().addSteps(0.05, fire);

    timeline.follow({ showTimeSeconds: 1, isPlaying: false, timeScale: 1 });
    expect(fired).toEqual([]);
  });

  test("lets a sleeping lane schedule nothing and wake at the playhead", () => {
    const timeline = createOrganTimeline(() => 0, 0.15);
    const { fired, fire } = record();
    const lane = timeline.createLane();
    lane.addSteps(1, fire);

    lane.setActive(false);
    timeline.follow({ showTimeSeconds: 0.9, isPlaying: true, timeScale: 1 });
    timeline.follow({ showTimeSeconds: 1.9, isPlaying: true, timeScale: 1 });
    expect(fired).toEqual([]);

    lane.setActive(true);
    timeline.follow({ showTimeSeconds: 7.9, isPlaying: true, timeScale: 1 });
    expect(fired.map((step) => step.index)).toEqual([8]);
  });

  test("does not send the captured backwards Sonar start to its voice", () => {
    // Issue 79: Tone's clock stayed at 1.552 + 0.1 lookahead while the
    // independent show clock advanced from Sonar call 86 to call 87.
    const timeline = createOrganTimeline(() => 1.652);
    const { fired, fire } = record();
    timeline.createLane().addSteps(1.6475, fire);

    timeline.follow({
      showTimeSeconds: 141.54666666666665,
      isPlaying: true,
      timeScale: 1,
    });
    expect(fired[0]?.audioTime).toBeCloseTo(1.7903333333333333, 9);
    timeline.follow({
      showTimeSeconds: 143.19466666666668,
      isPlaying: true,
      timeScale: 1,
    });

    // The second mapped start would be 1.7898333333333332, before the
    // already submitted start. Keep the existing call instead of retiming it.
    expect(fired).toHaveLength(1);
  });

  test("does not plan while the audio context is unavailable", () => {
    let audioTime: number | undefined;
    const timeline = createOrganTimeline(() => audioTime);
    const { fired, fire } = record();
    timeline.createLane().addSteps(1, fire);

    timeline.follow({ showTimeSeconds: 0.9, isPlaying: true, timeScale: 1 });
    timeline.follow({ showTimeSeconds: 1.9, isPlaying: true, timeScale: 1 });
    expect(fired).toEqual([]);

    audioTime = 100;
    timeline.follow({ showTimeSeconds: 7.9, isPlaying: true, timeScale: 1 });
    expect(fired).toEqual([{ index: 8, audioTime: 100.1 }]);
  });

  test("resumes on the current grid without replacing committed future starts", () => {
    let audioTime: number | undefined = 100;
    const timeline = createOrganTimeline(() => audioTime);
    const { fired, fire } = record();
    timeline.createLane().addSteps(0.125, fire);
    timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });
    expect(fired.map((step) => step.audioTime)).toEqual([100, 100.125]);

    audioTime = undefined;
    timeline.follow({ showTimeSeconds: 0.125, isPlaying: true, timeScale: 1 });
    expect(fired).toHaveLength(2);
    audioTime = 100.03125;
    timeline.follow({ showTimeSeconds: 0.25, isPlaying: true, timeScale: 1 });

    expect(fired).toEqual([
      { index: 0, audioTime: 100 },
      { index: 1, audioTime: 100.125 },
      { index: 3, audioTime: 100.15625 },
    ]);
    // A later attack may overlap the previous note's release; only already
    // submitted start times constrain ordering, not a synthetic note duration.
    expect(fired[2]?.audioTime).toBeLessThan(100.125 + 0.071);
  });

  test("resumes after a long suspension without replaying missed show steps", () => {
    let audioTime: number | undefined = 100;
    const timeline = createOrganTimeline(() => audioTime);
    const { fired, fire } = record();
    timeline.createLane().addSteps(0.125, fire);
    timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });

    audioTime = undefined;
    timeline.follow({ showTimeSeconds: 10, isPlaying: true, timeScale: 1 });
    expect(fired).toHaveLength(2);
    audioTime = 100.25;
    timeline.follow({ showTimeSeconds: 20, isPlaying: true, timeScale: 1 });

    expect(fired.slice(2)).toEqual([
      { index: 160, audioTime: 100.25 },
      { index: 161, audioTime: 100.375 },
    ]);
  });

  test("keeps committed starts when a lane reactivates or the show seeks back", () => {
    let audioTime = 100;
    const timeline = createOrganTimeline(() => audioTime);
    const { fired, fire } = record();
    const lane = timeline.createLane();
    lane.addSteps(0.125, fire);
    timeline.follow({ showTimeSeconds: 0.125, isPlaying: true, timeScale: 1 });
    lane.setActive(false);
    lane.setActive(true);
    timeline.follow({ showTimeSeconds: 0.125, isPlaying: true, timeScale: 1 });
    expect(fired).toHaveLength(2);

    audioTime = 100.125;
    timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });
    expect(fired).toEqual([
      { index: 1, audioTime: 100 },
      { index: 2, audioTime: 100.125 },
      { index: 1, audioTime: 100.25 },
    ]);
  });

  test("keeps new notes on the current show grid after a rate change", () => {
    let audioTime = 100;
    const timeline = createOrganTimeline(() => audioTime, 0.3);
    const { fired, fire } = record();
    timeline.createLane().addSteps(0.125, fire);
    timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });

    audioTime = 100.125;
    timeline.follow({ showTimeSeconds: 0.125, isPlaying: true, timeScale: 4 });
    expect(fired).toHaveLength(3);
    audioTime = 100.25;
    timeline.follow({ showTimeSeconds: 0.625, isPlaying: true, timeScale: 4 });
    expect(fired.slice(3)).toEqual([
      { index: 6, audioTime: 100.28125 },
      { index: 7, audioTime: 100.3125 },
    ]);
  });

  test("rejects starts inside Tone's one-microsecond comparison tolerance", () => {
    let audioTime = 100;
    const timeline = createOrganTimeline(() => audioTime);
    const { fired, fire } = record();
    const lane = timeline.createLane();
    lane.addSteps(1, fire);
    timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });

    for (const separation of [0.0000005, 0.000001]) {
      lane.setActive(false);
      lane.setActive(true);
      audioTime = 100 + separation;
      timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });
    }
    expect(fired).toEqual([{ index: 0, audioTime: 100 }]);

    lane.setActive(false);
    lane.setActive(true);
    audioTime = 100.000002;
    timeline.follow({ showTimeSeconds: 0, isPlaying: true, timeScale: 1 });
    expect(fired[1]).toEqual({ index: 0, audioTime: 100.000002 });
  });

  test("drops a disposed lane's tracks", () => {
    const timeline = createOrganTimeline(() => 0);
    const { fired, fire } = record();
    const lane = timeline.createLane();
    lane.addSteps(1, fire);
    lane.dispose();

    timeline.follow({ showTimeSeconds: 0.9, isPlaying: true, timeScale: 1 });
    expect(fired).toEqual([]);
  });
});
