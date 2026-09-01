/**
 * Purpose: Verify which key press means which operator action.
 * Context: The conductor is worked by keyboard while the operator watches the show.
 * Responsibility: Cover the map, the modifiers, and the presses we must not take.
 * Boundary: Acting on an action belongs to the page, not to the map.
 */

import { describe, expect, test } from "bun:test";
import {
  type ConductorKeyPress,
  resolveConductorKey,
} from "../../src/conductor/conductor-keys";
import { CONDUCTOR_SETTINGS } from "../../src/conductor/conductor-settings";

function press(overrides: Partial<ConductorKeyPress> = {}): ConductorKeyPress {
  return {
    code: "Space",
    isShiftHeld: false,
    isModifierHeld: false,
    isTypingTarget: false,
    ...overrides,
  };
}

describe("resolveConductorKey", () => {
  test("starts and holds the show on the space bar", () => {
    expect(resolveConductorKey(press())).toEqual({ kind: "toggleTransport" });
  });

  test("nudges the show with the arrow keys", () => {
    expect(resolveConductorKey(press({ code: "ArrowRight" }))).toEqual({
      kind: "seekBy",
      offsetSeconds: CONDUCTOR_SETTINGS.nudgeSeconds,
    });
    expect(resolveConductorKey(press({ code: "ArrowLeft" }))).toEqual({
      kind: "seekBy",
      offsetSeconds: -CONDUCTOR_SETTINGS.nudgeSeconds,
    });
  });

  test("takes a bigger step with shift held", () => {
    expect(
      resolveConductorKey(press({ code: "ArrowRight", isShiftHeld: true })),
    ).toEqual({
      kind: "seekBy",
      offsetSeconds: CONDUCTOR_SETTINGS.coarseNudgeSeconds,
    });
  });

  test("jumps to the cue the digit names", () => {
    expect(resolveConductorKey(press({ code: "Digit1" }))).toEqual({
      kind: "jumpToCue",
      cueIndex: 0,
    });
    expect(resolveConductorKey(press({ code: "Digit8" }))).toEqual({
      kind: "jumpToCue",
      cueIndex: 7,
    });
  });

  test("has no cue behind digit zero", () => {
    expect(resolveConductorKey(press({ code: "Digit0" }))).toBeUndefined();
  });

  test("reaches the resets", () => {
    expect(resolveConductorKey(press({ code: "Home" }))).toEqual({
      kind: "resetShow",
    });
    expect(resolveConductorKey(press({ code: "KeyR" }))).toEqual({
      kind: "resetFlight",
    });
    expect(resolveConductorKey(press({ code: "KeyL" }))).toEqual({
      kind: "toggleLanguage",
    });
  });

  test("leaves browser and system shortcuts alone", () => {
    expect(
      resolveConductorKey(press({ code: "KeyR", isModifierHeld: true })),
    ).toBeUndefined();
  });

  test("leaves typing alone", () => {
    expect(
      resolveConductorKey(press({ code: "Space", isTypingTarget: true })),
    ).toBeUndefined();
  });

  test("ignores a key the map does not name", () => {
    expect(resolveConductorKey(press({ code: "KeyQ" }))).toBeUndefined();
  });
});
