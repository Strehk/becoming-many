export interface StartParticleParameters {
  /** Fixed GPU capacity shared by the current ring, two arrow slots and three previews. */
  readonly count: number;
  readonly sizeMeters: number;
  readonly arrowLengthMeters?: number;
  readonly ringThicknessRatio?: number;
  readonly hazeFraction?: number;
  readonly maximumPointSizePixels?: number;
  /** Separate soft-puff cap; omitted recipes retain the fine-point cap. */
  readonly maximumHazePointSizePixels?: number;
  readonly color: number;
  readonly arrowAccentColor?: number;
  readonly crossingAccentColor?: number;
  readonly cloudRadiusMeters: number;
  readonly cloudDepthMeters: number;
  readonly driftAmplitudeMeters: number;
  readonly driftSpeed: number;
  /** Restrained brightness and point-edge accents in [0, 1]; zero disables each. */
  readonly sparkle: number;
  readonly glow: number;
}

export const START_PARTICLE_SETTINGS = {
  ringThicknessRatio: 0.24,
  hazeFraction: 0.12,
  maximumPointSizePixels: 24,
  crossingAccentColor: 0xdddddd,
  crossingExpansion: 0.065,
  crossingPulseDecay: 2.5,
  wakeDrag: 1.8,
  wakeSpeed: 1.5,
  arrowDriftSpeed: 0.35,
  arrowDriftAmplitude: 0.12,
} as const;

const MINIMUM_PARTICLE_COUNT = 32;
const MAXIMUM_PARTICLE_COUNT = 65_536;

/** Resolve authored omissions once and reject invalid settings before GPU allocation. */
export function readStartParticleSettings(
  authored: StartParticleParameters,
  arrowLengthMeters: number,
): Required<StartParticleParameters> {
  const settings = {
    ...authored,
    arrowLengthMeters,
    ringThicknessRatio:
      authored.ringThicknessRatio ?? START_PARTICLE_SETTINGS.ringThicknessRatio,
    hazeFraction: authored.hazeFraction ?? START_PARTICLE_SETTINGS.hazeFraction,
    maximumPointSizePixels:
      authored.maximumPointSizePixels ??
      START_PARTICLE_SETTINGS.maximumPointSizePixels,
    maximumHazePointSizePixels:
      authored.maximumHazePointSizePixels ??
      authored.maximumPointSizePixels ??
      START_PARTICLE_SETTINGS.maximumPointSizePixels,
    arrowAccentColor: authored.arrowAccentColor ?? authored.color,
    crossingAccentColor:
      authored.crossingAccentColor ??
      START_PARTICLE_SETTINGS.crossingAccentColor,
  };
  validateParameters(settings);
  return settings;
}

function validateParameters(
  parameters: Required<StartParticleParameters>,
): void {
  if (
    !Number.isInteger(parameters.count) ||
    parameters.count < MINIMUM_PARTICLE_COUNT ||
    parameters.count > MAXIMUM_PARTICLE_COUNT
  )
    throw new Error(
      `Start particle count must be an integer in [${MINIMUM_PARTICLE_COUNT}, ${MAXIMUM_PARTICLE_COUNT}]`,
    );
  validateDimensions(parameters);
  validateAppearance(parameters);
}

function validateDimensions(
  parameters: Required<StartParticleParameters>,
): void {
  for (const [key, maximum] of [
    ["arrowLengthMeters", 16],
    ["ringThicknessRatio", 0.6],
    ["maximumPointSizePixels", 48],
    ["maximumHazePointSizePixels", 48],
    ["sizeMeters", Number.POSITIVE_INFINITY],
    ["cloudRadiusMeters", Number.POSITIVE_INFINITY],
    ["cloudDepthMeters", Number.POSITIVE_INFINITY],
  ] as const) {
    const value = parameters[key];
    if (!Number.isFinite(value) || value <= 0 || value > maximum)
      throw new Error(
        `Start particle ${key} must be positive and at most ${maximum}`,
      );
  }
}

function validateAppearance(
  parameters: Required<StartParticleParameters>,
): void {
  const hazeFraction = parameters.hazeFraction;
  if (!Number.isFinite(hazeFraction) || hazeFraction < 0 || hazeFraction > 0.25)
    throw new Error("Start particle hazeFraction must be in [0, 0.25]");
  for (const key of ["driftAmplitudeMeters", "driftSpeed"] as const) {
    if (!Number.isFinite(parameters[key]) || parameters[key] < 0)
      throw new Error(`Start particle ${key} must be non-negative and finite`);
  }
  for (const key of ["sparkle", "glow"] as const) {
    if (
      !Number.isFinite(parameters[key]) ||
      parameters[key] < 0 ||
      parameters[key] > 1
    )
      throw new Error(`Start particle ${key} must be in [0, 1]`);
  }
}
