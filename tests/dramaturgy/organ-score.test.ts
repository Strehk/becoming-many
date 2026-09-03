/**
 * Purpose: Verify the organ score and the voice strengths derived from it.
 * Context: Which voice sounds when is dramaturgy; the organ only follows.
 * Responsibility: Cover the score's ladder shape and the fade it derives.
 * Boundary: How a voice sounds is the organ's concern, verified in a browser.
 */

import { describe, expect, test } from "bun:test";
import type { NarrationSchedule } from "../../src/dramaturgy/narration-schedule";
import {
  ORGAN_SCORE,
  ORGAN_VOICES,
  type OrganVoiceName,
  organVoiceStrengthAt,
} from "../../src/dramaturgy/organ-score";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import { SENSE_FADE_SECONDS } from "../../src/dramaturgy/show-levels";

const SCHEDULE: NarrationSchedule = {
  durationSeconds: 200,
  narration: [
    { cueId: "prologue", atSeconds: 10, level: "white-world" },
    { cueId: "scent", atSeconds: 50, level: "scent" },
    { cueId: "echo", atSeconds: 100, level: "echo" },
    { cueId: "return", atSeconds: 150, level: "white-world" },
  ],
};

const LADDER = [
  "white-world",
  "scent",
  "echo",
  "motion",
  "thermal",
  "magnetic",
  "connections",
] as const;

describe("ORGAN_SCORE", () => {
  test("names only voices the vocabulary has, each once per world", () => {
    for (const level of LADDER) {
      const voices = ORGAN_SCORE.voices[level];
      expect(new Set(voices).size).toBe(voices.length);
      for (const voice of voices) expect(ORGAN_VOICES).toContain(voice);
    }
  });

  test("layers voices up the ladder and never puts one away", () => {
    for (let rung = 1; rung < LADDER.length; rung += 1) {
      const below = ORGAN_SCORE.voices[LADDER[rung - 1] ?? "white-world"];
      const here = ORGAN_SCORE.voices[LADDER[rung] ?? "white-world"];
      for (const voice of below) expect(here).toContain(voice);
    }
  });

  test("carries the wind through the empty world and every voice by the end", () => {
    expect(ORGAN_SCORE.voices["white-world"]).toEqual(["wind"]);
    expect([...ORGAN_SCORE.voices.connections].sort()).toEqual(
      [...ORGAN_VOICES].sort(),
    );
  });

  test("keeps a slow, finite pulse", () => {
    expect(ORGAN_SCORE.pulseSeconds).toBeGreaterThan(0.5);
    expect(Number.isFinite(ORGAN_SCORE.pulseSeconds)).toBe(true);
  });
});

describe("organVoiceStrengthAt", () => {
  const at = (voice: OrganVoiceName, seconds: number): number =>
    organVoiceStrengthAt(SCHEDULE, ORGAN_SCORE, voice, seconds);

  test("opens silent and raises the opening world's voice at the first cue", () => {
    expect(at("wind", 0)).toBe(0);
    expect(at("wind", 10)).toBe(0);
    expect(at("wind", 10 + SENSE_FADE_SECONDS / 2)).toBeCloseTo(0.5, 6);
    expect(at("wind", 10 + SENSE_FADE_SECONDS)).toBe(1);
  });

  test("fades a voice in from the cue boundary of the world that carries it", () => {
    expect(at("choir", 49.99)).toBe(0);
    expect(at("choir", 50 + SENSE_FADE_SECONDS / 4)).toBeCloseTo(0.25, 6);
    expect(at("choir", 99)).toBe(1);
  });

  test("fades a voice out where the show returns to a world without it", () => {
    expect(at("sonar", 149)).toBe(1);
    expect(at("sonar", 150 + SENSE_FADE_SECONDS / 2)).toBeCloseTo(0.5, 6);
    expect(at("sonar", 200)).toBe(0);
    expect(at("wind", 200)).toBe(1);
  });

  test("keeps a voice the schedule never reaches silent throughout", () => {
    for (const seconds of [0, 60, 120, 199])
      expect(at("hiHat", seconds)).toBe(0);
  });

  test("hears every voice of the score somewhere in the piece", () => {
    const heard = new Set<OrganVoiceName>();
    for (
      let seconds = 0;
      seconds <= PIECE_SCHEDULE.durationSeconds;
      seconds += 1
    ) {
      for (const voice of ORGAN_VOICES) {
        if (
          organVoiceStrengthAt(PIECE_SCHEDULE, ORGAN_SCORE, voice, seconds) > 0
        ) {
          heard.add(voice);
        }
      }
    }
    expect([...heard].sort()).toEqual([...ORGAN_VOICES].sort());
  });
});
