/**
 * Hold an exclusively owned, unmodulated parameter while retiring its history.
 * Tone 14's bundled automation list retains past-only events; cancelling at now
 * does not bound repeated real-time writes. Read the rendered value before reset.
 */
export function holdAudioParameter(
  parameter: {
    readonly value: number;
    cancelScheduledValues(time: number): unknown;
    setValueAtTime(value: number, time: number): unknown;
  },
  now: number,
): void {
  const current = parameter.value;
  parameter.cancelScheduledValues(0);
  parameter.setValueAtTime(current, now);
}
