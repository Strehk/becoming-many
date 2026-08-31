/**
 * Purpose: Share the numeric range guards every sense parameter validator uses.
 * Context: Echo Depth, Thermal Perception, and Mycelium validate the same value shapes.
 * Responsibility: Answer whether one number is positive finite or normalized 0..1.
 * Boundary: Error messages and parameter semantics stay in each module's validator.
 */

export function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isNormalized(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
