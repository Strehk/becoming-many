/**
 * Purpose: Answer which world state and sense strengths hold at a show time.
 * Context: Schedule cues carry the level; senses fade in from cue boundaries.
 * Responsibility: Derive sense targets from supplied level recipes and own fade lookups.
 * Boundary: Presets, modules, and how intensities reach the GPU live elsewhere.
 */

import type { NarrationSchedule, ShowLevelName } from "./narration-schedule";

/** Every layered sense, named after the level that introduces it. */
export type ShowSense =
  | "scent"
  | "echo"
  | "motion"
  | "thermal"
  | "magnetic"
  | "connections";

export const SHOW_SENSES: readonly ShowSense[] = [
  "scent",
  "echo",
  "motion",
  "thermal",
  "magnetic",
  "connections",
];

/** Read-only subset of a level recipe; the Show owns no parallel configuration. */
export interface ShowLevelState {
  readonly backgroundColor: number;
  readonly viewDistance: number;
  readonly maximumGroundClearanceMeters: number;
  /** Scent presence is sufficient; its module has no authored intensity. */
  readonly scentParticles?: object;
  readonly echoDepth?: { readonly intensity: number };
  readonly motion?: { readonly intensity: number };
  readonly thermal?: { readonly intensity: number };
  readonly magnetic?: { readonly intensity: number };
  readonly connections?: { readonly intensity: number };
}

/** Read the target directly from the level's existing module block. */
export function levelSenseIntensity(
  level: ShowLevelState,
  sense: ShowSense,
): number {
  if (sense === "scent") return level.scentParticles ? 1 : 0;
  if (sense === "echo") return level.echoDepth?.intensity ?? 0;
  return level[sense]?.intensity ?? 0;
}

/**
 * How long a sense takes to reach its new strength after a cue boundary. One
 * shared dramaturgy constant: each fade starts exactly at its cue's
 * `atSeconds`, so the sense grows in under the narration that names it.
 * This derived ramp is the current complete intensity model.
 */
export const SENSE_FADE_SECONDS = 4;

/**
 * The world state holding at a show time. A cue's level holds until the next
 * cue starts, exactly like its recording; before the first cue the show
 * already stands in that cue's level, so the lead-in opens the first world.
 * Undefined only for a schedule with no cues.
 */
export function showLevelAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): ShowLevelName | undefined {
  let holding = schedule.narration[0];
  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;
    holding = cue;
  }
  return holding?.level;
}

/** The authored live state holding at one show time. */
export function showLevelStateAt(
  schedule: NarrationSchedule,
  states: Readonly<Record<ShowLevelName, ShowLevelState>>,
  showTimeSeconds: number,
): ShowLevelState | undefined {
  const levelName = showLevelAt(schedule, showTimeSeconds);
  return levelName === undefined ? undefined : states[levelName];
}

/** One world-state crossing: what the show is fading from, to, and how far. */
export interface LevelTransition {
  /** The world state before the most recent cue boundary. */
  readonly from: ShowLevelName;
  /** The world state the schedule now calls for. */
  readonly to: ShowLevelName;
  /** 0..1 progress of the crossing; 1 once the fade window has passed. */
  readonly progress: number;
}

/**
 * The world-state crossing in effect at a show time, for values that blend
 * between levels rather than belonging to one sense — the background color
 * above all. Before the first cue `from` equals `to`, so the progress does
 * not matter there; after a boundary the progress climbs to one over the fade
 * window and stays there. Cue slots are far longer than the fade, so a
 * boundary landing inside a still-running fade is not modeled: `from` is
 * simply the previous cue's level. Undefined only for a schedule with no
 * cues.
 */
export function levelTransitionAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): LevelTransition | undefined {
  let holding = schedule.narration[0];
  let previous = schedule.narration[0];
  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;
    previous = holding;
    holding = cue;
  }
  if (!holding || !previous) return undefined;

  const elapsed = showTimeSeconds - holding.atSeconds;
  const progress =
    elapsed >= SENSE_FADE_SECONDS
      ? 1
      : Math.max(elapsed / SENSE_FADE_SECONDS, 0);
  return { from: previous.level, to: holding.level, progress };
}

/**
 * One sense's strength at a show time, in 0..1. Each cue boundary sets a new
 * target from its level recipe — zero when the module is absent —
 * and the strength moves linearly from wherever it stood at the boundary to
 * that target over `SENSE_FADE_SECONDS`. The value is derived purely from the
 * schedule and the asked instant, never accumulated, so a seek or scrub lands
 * mid-fade exactly where playing through would have.
 */
export function senseIntensityAt(
  schedule: NarrationSchedule,
  states: Readonly<Record<ShowLevelName, ShowLevelState>>,
  sense: ShowSense,
  showTimeSeconds: number,
): number {
  // The show opens with no senses; the first cue's boundary raises them.
  let rampStartSeconds = 0;
  let rampStartValue = 0;
  let rampTarget = 0;

  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;

    rampStartValue = rampValueAt(
      rampStartSeconds,
      rampStartValue,
      rampTarget,
      cue.atSeconds,
    );
    rampStartSeconds = cue.atSeconds;
    rampTarget = levelSenseIntensity(states[cue.level], sense);
  }

  return rampValueAt(
    rampStartSeconds,
    rampStartValue,
    rampTarget,
    showTimeSeconds,
  );
}

/**
 * Where a linear ramp stands at an instant: from its start value toward its
 * target over `SENSE_FADE_SECONDS`. Shared with the organ score, so a voice
 * fades on exactly the curve a sense does.
 */
export function rampValueAt(
  rampStartSeconds: number,
  rampStartValue: number,
  rampTarget: number,
  atSeconds: number,
): number {
  const elapsed = atSeconds - rampStartSeconds;
  if (elapsed >= SENSE_FADE_SECONDS) return rampTarget;
  if (elapsed <= 0) return rampStartValue;

  return (
    rampStartValue +
    ((rampTarget - rampStartValue) * elapsed) / SENSE_FADE_SECONDS
  );
}
