/** Sample sequential visual fades from closing narration time, in seconds. */
export function sampleClosingPresence(
  seconds: number,
  settings: {
    closingPathFadeSeconds: number;
    closingWorldFadeSeconds: number;
    closingWhiteHoldSeconds: number;
  },
): { course: number; world: number; ready: boolean } {
  const pathEnd = settings.closingPathFadeSeconds;
  const worldEnd = pathEnd + settings.closingWorldFadeSeconds;
  return {
    course: fade(seconds / pathEnd),
    world: fade((seconds - pathEnd) / settings.closingWorldFadeSeconds),
    ready: seconds >= worldEnd + settings.closingWhiteHoldSeconds,
  };
}

// Smooth endpoints avoid a visible change in fade velocity.
function fade(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 - clamped * clamped * (3 - 2 * clamped);
}
