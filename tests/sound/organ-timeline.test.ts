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
