import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { attachScrubbing } from "../../src/ui/shared/transport-scrubbing";

/** Model only the pointer-capture surface; no browser rendering is needed. */
class PointerTrack extends EventTarget {
  captured: number | undefined;

  getBoundingClientRect(): { left: number; width: number } {
    return { left: 0, width: 100 };
  }

  setPointerCapture(pointerId: number): void {
    this.captured = pointerId;
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured === pointerId;
  }

  releasePointerCapture(pointerId: number): void {
    if (this.captured !== pointerId) return;
    this.captured = undefined;
    this.pointer("lostpointercapture", 0, pointerId);
  }

  pointer(type: string, clientX: number, pointerId = 1, button = 0): void {
    this.dispatchEvent(
      Object.assign(new Event(type), { clientX, pointerId, button }),
    );
  }
}

const clock = spyOn(performance, "now");
afterEach(() => clock.mockReset());
afterAll(() => clock.mockRestore());

function mount(playing = true, readDurationSeconds = () => 100) {
  clock.mockReturnValue(0);
  const track = new PointerTrack();
  const lifetime = new AbortController();
  const seeks: number[] = [];
  const previews: (number | undefined)[] = [];
  const playback: string[] = [];
  attachScrubbing({
    track: track as unknown as SVGSVGElement,
    readDurationSeconds,
    show: {
      sample: () => ({
        isPlaying: playing,
        timeSeconds: 0,
        timeScale: 1,
      }),
      pause: () => playback.push("pause"),
      play: () => playback.push("play"),
      seekTo: (seconds) => seeks.push(seconds),
    },
    onScrubChange: (seconds) => previews.push(seconds),
    signal: lifetime.signal,
  });
  return { track, lifetime, seeks, previews, playback };
}

describe("shared transport scrubbing", () => {
  test("reads the current duration for each gesture", () => {
    let durationSeconds = 160;
    const { track, seeks } = mount(false, () => durationSeconds);
    track.pointer("pointerdown", 50);
    track.pointer("pointerup", 50);
    durationSeconds = 124;
    track.pointer("pointerdown", 50);
    track.pointer("pointerup", 50);
    expect(seeks).toEqual([80, 80, 62, 62]);
  });

  test("previews throttled moves and commits the exact release before resuming", () => {
    const { track, seeks, previews, playback } = mount();
    track.pointer("pointerdown", 10);
    clock.mockReturnValue(10);
    track.pointer("pointermove", 20);
    expect(seeks).toEqual([10]);
    expect(previews).toEqual([10, 20]);
    clock.mockReturnValue(50);
    track.pointer("pointermove", 30);
    track.pointer("pointerup", 35);
    expect(seeks).toEqual([10, 30, 35]);
    expect(previews.at(-1)).toBeUndefined();
    expect(playback).toEqual(["pause", "play"]);
    expect(track.captured).toBeUndefined();
  });

  test("preserves an already held show and clamps release to the track", () => {
    const { track, seeks, playback } = mount(false);
    track.pointer("pointerdown", -10);
    track.pointer("pointerup", 120);
    expect(seeks).toEqual([0, 100]);
    expect(playback).toEqual([]);
  });

  for (const event of ["pointercancel", "lostpointercapture"]) {
    test(`${event} commits the last preview once and restores playback`, () => {
      const { track, seeks, previews, playback } = mount();
      track.pointer("pointerdown", 10);
      track.pointer("pointermove", 45);
      track.pointer(event, 0);
      track.pointer("pointerup", 90);
      expect(seeks).toEqual([10, 45]);
      expect(previews).toEqual([10, 45, undefined]);
      expect(playback).toEqual(["pause", "play"]);
      expect(track.captured).toBeUndefined();
    });
  }

  test("unmount releases capture and listeners without restarting the show", () => {
    const { track, lifetime, seeks, previews, playback } = mount();
    track.pointer("pointerdown", 10);
    track.pointer("pointermove", 45);
    lifetime.abort();
    lifetime.abort();
    track.pointer("pointerup", 80);
    track.pointer("pointerdown", 90);
    expect(track.captured).toBeUndefined();
    expect(seeks).toEqual([10]);
    expect(previews).toEqual([10, 45, undefined]);
    expect(playback).toEqual(["pause"]);
  });

  test("ignores secondary buttons and other pointers during a drag", () => {
    const { track, seeks, playback } = mount();
    track.pointer("pointerdown", 5, 1, 2);
    track.pointer("pointerdown", 10);
    track.pointer("pointerdown", 80, 2);
    track.pointer("pointermove", 90, 2);
    track.pointer("pointerup", 90, 2);
    expect(seeks).toEqual([10]);
    expect(playback).toEqual(["pause"]);
    track.pointer("pointerup", 20);
    expect(seeks).toEqual([10, 20]);
    expect(playback).toEqual(["pause", "play"]);
  });
});
