/**
 * Purpose: Define every message the show window and the conductor exchange.
 * Context: The two pages are separate windows joined only by a localhost broker.
 * Responsibility: Own the message union and turn untrusted wire text into it.
 * Boundary: Transport, reconnection, and what a command means live elsewhere.
 */

import type { NarrationLanguage } from "../dramaturgy/narration-catalog";

/** Which page a socket belongs to. The broker relays between the two. */
export type StationRole = "show" | "conductor";

/**
 * The audio context state, restated here rather than reusing the DOM's
 * `AudioContextState`: the broker runs under Bun and has no DOM lib. It must
 * stay assignable from that type, so it carries the "interrupted" state iOS
 * uses as well. Anything but "running" means show time is frozen.
 */
export type ShowAudioState = "suspended" | "running" | "closed" | "interrupted";

/**
 * Conductor to show. Every command is one transport move or one reset; the
 * conductor never sends show state, because the show clock is the authority.
 */
export type ShowCommand =
  | { readonly kind: "play" }
  | { readonly kind: "pause" }
  | { readonly kind: "seekTo"; readonly showTimeSeconds: number }
  | { readonly kind: "seekBy"; readonly offsetSeconds: number }
  | { readonly kind: "setTimeScale"; readonly timeScale: number }
  | { readonly kind: "setLanguage"; readonly language: NarrationLanguage }
  /** Rewind to the top and hold there. */
  | { readonly kind: "resetShow" }
  | { readonly kind: "resetFlight" }
  | { readonly kind: "reloadShow" }
  /** Point the show at an M5 tilt controller; an empty host stops polling. */
  | { readonly kind: "setM5Host"; readonly host: string };

/** Show to conductor, at `STATION_SETTINGS.statusHertz`. */
export interface ShowStatus {
  readonly kind: "status";
  readonly showTimeSeconds: number;
  readonly isPlaying: boolean;
  readonly timeScale: number;
  readonly language: NarrationLanguage;
  readonly levelName: string;
  readonly audioState: ShowAudioState;
  /** Both absent until frames have been measured. */
  readonly framesPerSecond?: number;
  readonly p95Milliseconds?: number;
  /** All three absent from a show build that predates the M5 adapter. */
  readonly m5State?: M5LinkState;
  readonly m5Quality?: number;
  readonly hasM5FirmwareMismatch?: boolean;
}

/**
 * The M5 device as the show sees it. Mirrors the adapter's operator status:
 * `off` = no host configured, `connecting` = host set but nothing fresh,
 * `wrong-device` = a payload from a different deviceId — warned, never steering.
 */
export type M5LinkState = "off" | "connecting" | "live" | "wrong-device";

/**
 * The show length is deliberately not on the wire. Both pages import
 * `PIECE_SCHEDULE` from the one schedule authority, and sending it would make
 * the show a second one.
 */

/**
 * Broker to conductor. A socket closing is the only way the conductor learns
 * the show window is gone, so the broker says it rather than leaving the last
 * status standing as if it were still true.
 */
export interface PeerPresence {
  readonly kind: "presence";
  readonly role: StationRole;
  readonly isConnected: boolean;
}

export type StationMessage = ShowCommand | ShowStatus | PeerPresence;

const SHOW_AUDIO_STATES: readonly ShowAudioState[] = [
  "suspended",
  "running",
  "closed",
  "interrupted",
];
const STATION_ROLES: readonly StationRole[] = ["show", "conductor"];
const M5_LINK_STATES: readonly M5LinkState[] = [
  "off",
  "connecting",
  "live",
  "wrong-device",
];
const NARRATION_LANGUAGES: readonly NarrationLanguage[] = ["en", "de"];

export function serializeStationMessage(message: StationMessage): string {
  return JSON.stringify(message);
}

/**
 * Nothing arriving on a socket is trusted. An unparseable, unknown, or
 * ill-typed message answers `undefined` so the caller can drop it, rather than
 * throwing inside a socket handler where there is nobody to catch it.
 */
export function parseStationMessage(raw: string): StationMessage | undefined {
  const value: unknown = parseJson(raw);
  if (!isRecord(value)) return undefined;

  switch (value.kind) {
    case "play":
    case "pause":
    case "resetShow":
    case "resetFlight":
    case "reloadShow":
      return { kind: value.kind };
    case "seekTo":
      return isFiniteNumber(value.showTimeSeconds)
        ? { kind: "seekTo", showTimeSeconds: value.showTimeSeconds }
        : undefined;
    case "seekBy":
      return isFiniteNumber(value.offsetSeconds)
        ? { kind: "seekBy", offsetSeconds: value.offsetSeconds }
        : undefined;
    case "setTimeScale":
      // The clock itself rejects a non-positive rate; catching it here keeps
      // that RangeError out of a socket handler.
      return isFiniteNumber(value.timeScale) && value.timeScale > 0
        ? { kind: "setTimeScale", timeScale: value.timeScale }
        : undefined;
    case "setLanguage":
      return isOneOf(value.language, NARRATION_LANGUAGES)
        ? { kind: "setLanguage", language: value.language }
        : undefined;
    case "setM5Host":
      return typeof value.host === "string"
        ? { kind: "setM5Host", host: value.host }
        : undefined;
    case "status":
      return parseStatus(value);
    case "presence":
      return isOneOf(value.role, STATION_ROLES) &&
        typeof value.isConnected === "boolean"
        ? { kind: "presence", role: value.role, isConnected: value.isConnected }
        : undefined;
    default:
      return undefined;
  }
}

function parseStatus(value: Record<string, unknown>): ShowStatus | undefined {
  const {
    showTimeSeconds,
    isPlaying,
    timeScale,
    language,
    levelName,
    audioState,
    framesPerSecond,
    p95Milliseconds,
    m5State,
    m5Quality,
    hasM5FirmwareMismatch,
  } = value;

  if (
    !isFiniteNumber(showTimeSeconds) ||
    typeof isPlaying !== "boolean" ||
    !isFiniteNumber(timeScale) ||
    !isOneOf(language, NARRATION_LANGUAGES) ||
    typeof levelName !== "string" ||
    !isOneOf(audioState, SHOW_AUDIO_STATES) ||
    !isOptionalFiniteNumber(framesPerSecond) ||
    !isOptionalFiniteNumber(p95Milliseconds) ||
    !isOptionalOneOf(m5State, M5_LINK_STATES) ||
    !isOptionalFiniteNumber(m5Quality) ||
    !isOptionalBoolean(hasM5FirmwareMismatch)
  ) {
    return undefined;
  }

  return {
    kind: "status",
    showTimeSeconds,
    isPlaying,
    timeScale,
    language,
    levelName,
    audioState,
    framesPerSecond,
    p95Milliseconds,
    m5State,
    m5Quality,
    hasM5FirmwareMismatch,
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** JSON drops an undefined field, so a missing metric arrives as absent. */
function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isOptionalOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T | undefined {
  return value === undefined || isOneOf(value, allowed);
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}
