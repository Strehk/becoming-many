/**
 * Purpose: Define the Motion Perception level preset ("Frog and insects", level 04).
 * Context: Motion Perception (level 04) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { level as echoLevel } from "./echo.level";
import type { LevelPreset } from "./level-runtime";
import { sharedMotionSense } from "./shared-level-values";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Echolocation preset
  // verbatim, and the decided art direction keeps the pale haze as the
  // ground the ink-dark motion language prints against.
  ...echoLevel,
  maximumGroundClearanceMeters: 50,
  // New in level 04: the moodboard palette #212133 #312758 #45577A #10BEDB
  // #E3DFDD #F3952D colors the flies, trails, and bird traces; the orange
  // accent stays reserved for later motion actors (exit cues).
  motion: sharedMotionSense,
};
