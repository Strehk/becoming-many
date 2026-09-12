import { expect, test } from "bun:test";
import { createStartRecording } from "../../../src/modules/start/start-recording";

test("opening speech maps all reveal boundaries onto the original course timeline", () => {
  const german = createStartRecording("right", "en", "de");
  expect(german.url).toBe("/audio/tutorial/de/introduction-right.wav");
  expect(german.timeMap).toEqual([
    { offsetSeconds: 8, nativeSeconds: 6.38 },
    { offsetSeconds: 11.2, nativeSeconds: 9.58 },
    { offsetSeconds: 12.94, nativeSeconds: 13.36 },
    { offsetSeconds: 16.14, nativeSeconds: 16.56 },
    { offsetSeconds: 17.16, nativeSeconds: 19.3 },
    { offsetSeconds: 18.174938, nativeSeconds: 20.725729 },
  ]);
  const english = createStartRecording("right", "de", "en");
  expect(english.timeMap).toEqual(
    german.timeMap?.map(({ offsetSeconds, nativeSeconds }) => ({
      offsetSeconds: nativeSeconds,
      nativeSeconds: offsetSeconds,
    })),
  );
});

test.each(["left", "up", "down", "complete"] as const)(
  "%s retains instruction or closing boundaries when switching",
  (cue) => {
    const recording = createStartRecording(cue, "en", "de");
    expect(
      recording.timeMap?.every(
        (marker, index, markers) =>
          index === 0 ||
          (marker.offsetSeconds > (markers[index - 1]?.offsetSeconds ?? 0) &&
            marker.nativeSeconds > (markers[index - 1]?.nativeSeconds ?? 0)),
      ),
    ).toBe(true);
    if (cue === "complete")
      expect(recording.timeMap?.slice(0, 3)).toEqual([
        { offsetSeconds: 3, nativeSeconds: 3 },
        { offsetSeconds: 6, nativeSeconds: 6 },
        { offsetSeconds: 8, nativeSeconds: 8 },
      ]);
    expect(createStartRecording(cue, "en", "en").timeMap).toBeUndefined();
  },
);
