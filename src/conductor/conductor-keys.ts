/**
 * Purpose: Turn a key press on the conductor page into one operator action.
 * Context: A conductor works the keyboard, not the mouse, while watching the show.
 * Responsibility: Own the key map and refuse presses meant for something else.
 * Boundary: Sending the resulting command belongs to the page that reads this.
 */

import { CONDUCTOR_SETTINGS } from "./conductor-settings";

/** What a key press asks the show to do. */
export type ConductorAction =
  | { readonly kind: "toggleTransport" }
  | { readonly kind: "seekBy"; readonly offsetSeconds: number }
  | { readonly kind: "jumpToCue"; readonly cueIndex: number }
  | { readonly kind: "resetShow" }
  | { readonly kind: "resetFlight" }
  | { readonly kind: "toggleLanguage" };

/**
 * The parts of a key press this decision needs. Taking a plain record rather
 * than a `KeyboardEvent` keeps the map testable without a DOM.
 */
export interface ConductorKeyPress {
  /** Physical key, so the map holds on any keyboard layout. */
  readonly code: string;
  readonly isShiftHeld: boolean;
  /** Ctrl, Alt, or Meta: a browser or OS shortcut, not ours to take. */
  readonly isModifierHeld: boolean;
  /** The press landed in a text field, where keys mean characters. */
  readonly isTypingTarget: boolean;
}

const DIGIT_PREFIX = "Digit";

export function resolveConductorKey(
  press: ConductorKeyPress,
): ConductorAction | undefined {
  if (press.isModifierHeld || press.isTypingTarget) return undefined;

  const nudgeSeconds = press.isShiftHeld
    ? CONDUCTOR_SETTINGS.coarseNudgeSeconds
    : CONDUCTOR_SETTINGS.nudgeSeconds;

  switch (press.code) {
    case "Space":
      return { kind: "toggleTransport" };
    case "ArrowLeft":
      return { kind: "seekBy", offsetSeconds: -nudgeSeconds };
    case "ArrowRight":
      return { kind: "seekBy", offsetSeconds: nudgeSeconds };
    case "Home":
      return { kind: "resetShow" };
    case "KeyR":
      return { kind: "resetFlight" };
    case "KeyL":
      return { kind: "toggleLanguage" };
    default:
      return resolveCueDigit(press.code);
  }
}

/** Digit one selects the first cue, so the label matches the key. */
function resolveCueDigit(code: string): ConductorAction | undefined {
  if (!code.startsWith(DIGIT_PREFIX)) return undefined;

  const digit = Number(code.slice(DIGIT_PREFIX.length));
  if (!Number.isInteger(digit) || digit < 1) return undefined;

  return { kind: "jumpToCue", cueIndex: digit - 1 };
}
