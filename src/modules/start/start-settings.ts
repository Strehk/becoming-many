import type { StartParticleParameters } from "./start-particle-settings";

export type StartDirection = "right" | "left" | "up" | "down";

export type DistanceRange = readonly [minimum: number, maximum: number];

export interface StartParameters {
  /** Relative level of the existing organ wind during practice, 0..1. */
  readonly windStrength?: number;
  /** Show limits integrated practice; standalone Start remains an independent test. */
  readonly maximumPracticeSeconds: number;
  readonly directions: readonly [StartDirection, ...StartDirection[]];
  /** Sampled per course section in the current view; live goals stay world-fixed. */
  readonly course: {
    readonly firstDistanceMeters: DistanceRange;
    readonly spacingMeters: DistanceRange;
    readonly radiusMeters: DistanceRange;
  };
  readonly arrivalSeconds: number;
  readonly formationSeconds: number;
  readonly dissolutionSeconds: number;
  /** Omission creates no particle resources or presentation work. */
  readonly particles?: StartParticleParameters;
}

/** Technical learning/course limits. Level-authored timings and appearance stay in the level recipe. */
export const START_SETTINGS = {
  turnComponent: 0.12,
  turnConfirmSeconds: 0.2,
  arrowOutOfViewSeconds: 2,
  arrowFadeSeconds: 3,
  arrowForwardComponent: 0.8,
  arrowTurnComponent: 0.6,
  arrowTunnelClearanceMeters: 0.75,
  minimumArrowLeadMeters: 8,
  minimumRingSpacingMeters: 1,
  minimumTravelSquared: 0.000001,
  motionHistorySeconds: 0.25,
  maximumCurvaturePerMeter: 0.12,
  curvatureDecayMeters: 4,
  maximumObservedSpeedMetersPerSecond: 12,
  courseSampleCount: 32,
  courseEntrySample: 24,
  lessonBendComponent: 0.12,
} as const;

/** Reject malformed learning parameters before acquiring presentation resources. */
export function validateStartParameters(parameters: StartParameters): void {
  const positive = [
    parameters.arrivalSeconds,
    parameters.formationSeconds,
    parameters.dissolutionSeconds,
  ];
  if (
    positive.some((number) => !Number.isFinite(number) || number <= 0) ||
    !parameters.directions.length ||
    Object.values(parameters.course).some(
      ([minimum, maximum]) =>
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum <= 0 ||
        maximum < minimum,
    )
  )
    throw new Error("Start needs positive timings and ordered distance ranges");
}
