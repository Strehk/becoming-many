/**
 * Purpose: Verify the transport invariants rehearsal depends on.
 * Context: Show time is derived from an injectable timebase, never accumulated.
 * Responsibility: Cover play, pause, seek, time scale, and timebase stalls.
 * Boundary: Audio playback and schedule lookup are tested separately.
 */

import { describe, expect, test } from "bun:test";
import { createShowClock } from "../../src/dramaturgy/show-clock";

const SHOW_DURATION_SECONDS = 500;

describe("ShowClock", () => {
  test("starts paused at the beginning of the show", () => {
    const { clock } = createTestClock();

    expect(clock.sample()).toEqual({
      timeSeconds: 0,
      isPlaying: false,
      timeScale: 1,
    });
  });

  test("holds show time while paused even as the timebase runs", () => {
    const { clock, advance } = createTestClock();

    advance(30);

    expect(clock.sample().timeSeconds).toBe(0);
  });

  test("advances one for one with the timebase while playing", () => {
    const { clock, advance } = createTestClock();

    clock.play();
    advance(12.5);

    expect(clock.sample().timeSeconds).toBe(12.5);
  });

  test("resumes from where it was paused instead of from the timebase", () => {
    const { clock, advance } = createTestClock();

    clock.play();
    advance(10);
    clock.pause();
    advance(100);
    clock.play();
    advance(5);

    expect(clock.sample().timeSeconds).toBe(15);
  });

  test("keeps advancing from a seek made while playing", () => {
    const { clock, advance } = createTestClock();

    clock.play();
    advance(10);
    clock.seekTo(200);
    advance(4);

    expect(clock.sample().timeSeconds).toBe(204);
  });

  test("holds a seek made while paused", () => {
    const { clock, advance } = createTestClock();

    clock.seekTo(200);
    advance(60);

    expect(clock.sample().timeSeconds).toBe(200);
  });

  test("clamps seeks to the show", () => {
    const { clock } = createTestClock();

    clock.seekTo(-5);
    expect(clock.sample().timeSeconds).toBe(0);

    clock.seekTo(SHOW_DURATION_SECONDS + 1000);
    expect(clock.sample().timeSeconds).toBe(SHOW_DURATION_SECONDS);
  });

  test("scrubs relative to the current instant in both directions", () => {
    const { clock, advance } = createTestClock();

    clock.play();
    advance(100);
    clock.seekBy(30);
    expect(clock.sample().timeSeconds).toBe(130);

    clock.seekBy(-50);
    expect(clock.sample().timeSeconds).toBe(80);
  });

  test("advances at the configured rate", () => {
    const { clock, advance } = createTestClock();

    clock.setTimeScale(2);
    clock.play();
    advance(10);

    expect(clock.sample().timeSeconds).toBe(20);
  });

  test("does not move the playhead when the rate changes mid-show", () => {
    const { clock, advance } = createTestClock();

    clock.play();
    advance(10);
    clock.setTimeScale(4);

    expect(clock.sample().timeSeconds).toBe(10);

    advance(2);
    expect(clock.sample().timeSeconds).toBe(18);
  });

  test("freezes show time when the timebase stalls", () => {
    const { clock, advance } = createTestClock();

    clock.play();
    advance(10);
    // A suspended audio context stops reporting new times; the show must not
    // run away from the narration it drives.
    expect(clock.sample().timeSeconds).toBe(10);
    expect(clock.sample().timeSeconds).toBe(10);
  });

  test("rejects a show that has no length", () => {
    expect(() => createShowClock(0, () => 0)).toThrow(RangeError);
    expect(() => createShowClock(Number.NaN, () => 0)).toThrow(RangeError);
  });

  test("rejects a rate that would become a second way to pause", () => {
    const { clock } = createTestClock();

    expect(() => clock.setTimeScale(0)).toThrow(RangeError);
    expect(() => clock.setTimeScale(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });

  test("rejects a seek that is not a real time", () => {
    const { clock } = createTestClock();

    expect(() => clock.seekTo(Number.NaN)).toThrow(RangeError);
  });
});

function createTestClock() {
  let timebaseSeconds = 0;
  const clock = createShowClock(SHOW_DURATION_SECONDS, () => timebaseSeconds);

  return {
    clock,
    advance: (bySeconds: number): void => {
      timebaseSeconds += bySeconds;
    },
  };
}
