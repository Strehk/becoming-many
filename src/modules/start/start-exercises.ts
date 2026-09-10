import type { ExerciseDefinition } from "./start-contract";

// 1. Shared demo and presentation settings
export const START_SETTINGS = {
  demonstrationCueSeconds: 2,
  retireSeconds: 1.2,
  belowFlightMeters: 0.5,
  seed: 17,
  entryLeadMeters: 12,
  generationMetersPerStep: 4,
  revealSeconds: 0.8,
};

// 2. Exercise sequence
// The MVP demonstrates both turn directions. Narration ordering is authored later.
export const START_EXERCISES = [
  {
    id: "left",
    route: {
      leadMeters: 0,
      straightMeters: 10,
      outroMeters: 24,
      turnSign: -1,
      turnRadiusMeters: { from: 38, to: 46 },
      turnRadians: { from: 0.8, to: 1.05 },
    },
    particles: {
      densityPerMeter: { from: 40, to: 68 },
      color: { from: 0x2c858d, to: 0x77bec2 },
      sizeMeters: { from: 0.025, to: 0.055 },
      spreadMeters: 0.55,
      seed: 17,
    },
    deviation: {
      distanceMeters: 5,
      outsideTravelMeters: 3,
      maximumStepMeters: 3,
    },
    progress: {
      checkpointSpacingMeters: 2,
      toleranceMeters: 1.4,
      extraTravelMeters: 7,
      maximumStepMeters: 3,
    },
  },
  {
    id: "right",
    route: {
      leadMeters: 0,
      straightMeters: 10,
      outroMeters: 24,
      turnSign: 1,
      turnRadiusMeters: { from: 38, to: 46 },
      turnRadians: { from: 0.8, to: 1.05 },
    },
    particles: {
      densityPerMeter: { from: 40, to: 68 },
      color: { from: 0x2c858d, to: 0x77bec2 },
      sizeMeters: { from: 0.025, to: 0.055 },
      spreadMeters: 0.55,
      seed: 17,
    },
    deviation: {
      distanceMeters: 5,
      outsideTravelMeters: 3,
      maximumStepMeters: 3,
    },
    progress: {
      checkpointSpacingMeters: 2,
      toleranceMeters: 1.4,
      extraTravelMeters: 7,
      maximumStepMeters: 3,
    },
  },
] as const satisfies readonly ExerciseDefinition[];
