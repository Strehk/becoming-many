import type { StartSequence } from "./start-contract";

// Recording time is the only input; the caller retains completed world reveal.
/** Smooth 0–1 world presence. Does not advance time or mutate the authored sequence. */
export function sampleWorldPresence(
  sequence: StartSequence,
  offsetSeconds: number,
): number {
  const reveal = sequence.worldReveal;
  if (!reveal) return 1;
  if (
    !Number.isFinite(reveal.atSeconds) ||
    reveal.atSeconds < 0 ||
    !Number.isFinite(reveal.fadeSeconds) ||
    reveal.fadeSeconds <= 0
  )
    throw new RangeError(
      "World reveal requires a nonnegative cue and positive fade duration",
    );
  const progress = Math.max(
    0,
    Math.min(1, (offsetSeconds - reveal.atSeconds) / reveal.fadeSeconds),
  );
  return progress * progress * (3 - 2 * progress);
}
