/**
 * Purpose: Answer "is everything all right" from across the room.
 * Context: A suspended audio context freezes show time and looks like a pause.
 * Responsibility: Render connection, audio, frame rate, level, and language.
 * Boundary: The page decides what the readings mean; this only shows them.
 */

import type { ShowAudioState, ShowStatus } from "../station/station-protocol";
import type { ConductorPanel, ConductorState } from "./conductor-state";

type ReadingState = "idle" | "live" | "warn" | "alarm";

interface Reading {
  readonly element: HTMLElement;
  readonly write: (text: string, state: ReadingState) => void;
}

export function createStatusStrip(parent: HTMLElement): ConductorPanel {
  const root = document.createElement("header");
  root.className = "conductor__status";
  root.setAttribute("aria-label", "Station status");

  const station = createReading(root, "station");
  const show = createReading(root, "show");
  const audio = createReading(root, "audio");
  const frames = createReading(root, "frames");
  const m5 = createReading(root, "m5");
  const level = createReading(root, "level");
  const language = createReading(root, "language");

  // Show time derives from the audio clock, so a context that never received a
  // gesture freezes the piece while looking exactly like a pause. Only a click
  // in the show window can clear it — this page cannot.
  const banner = document.createElement("p");
  banner.className = "conductor__banner";
  banner.hidden = true;
  parent.append(root, banner);

  banner.textContent =
    "Show time is frozen: click once in the show window to start its audio clock. Re-entering VR needs that click too.";

  return {
    update(state): void {
      const audioState = state.status?.audioState;

      station.write(...stationReading(state));
      show.write(...showReading(state));
      audio.write(audioState ?? "unknown", audioReadingState(audioState));
      frames.write(...frameReading(state));
      m5.write(...m5Reading(state.status));
      level.write(state.status?.levelName ?? "—", "idle");
      language.write(state.language.toUpperCase(), "idle");

      // Undefined means nothing has reported yet, which the show reading
      // already covers; only a context that answered and is not running here.
      banner.hidden = audioState === undefined || audioState === "running";
    },
  };
}

type ReadingText = readonly [text: string, state: ReadingState];

function stationReading(state: ConductorState): ReadingText {
  return state.isStationConnected
    ? ["connected", "live"]
    : ["no broker", "alarm"];
}

function showReading(state: ConductorState): ReadingText {
  if (!state.isShowConnected) return ["window closed", "alarm"];

  return state.isLive ? ["reporting", "live"] : ["not answering", "warn"];
}

function audioReadingState(
  audioState: ShowAudioState | undefined,
): ReadingState {
  if (audioState === undefined) return "idle";

  return audioState === "running" ? "live" : "warn";
}

/**
 * Absent fields mean a show build without the M5 adapter, or no host set —
 * both read as "no device", which is a normal state, not a fault. A firmware
 * mismatch is appended so a drifted flash never hides behind a green "live".
 */
function m5Reading(status: ShowStatus | undefined): ReadingText {
  const m5State = status?.m5State;
  if (m5State === undefined || m5State === "off") return ["—", "idle"];

  const mismatchSuffix = status?.hasM5FirmwareMismatch ? " · fw!" : "";
  if (m5State === "wrong-device") {
    return [`wrong device${mismatchSuffix}`, "alarm"];
  }
  if (m5State === "connecting") {
    return [`connecting${mismatchSuffix}`, "warn"];
  }

  const quality = status?.m5Quality?.toFixed(2) ?? "?";
  return [
    `live · q${quality}${mismatchSuffix}`,
    status?.hasM5FirmwareMismatch ? "warn" : "live",
  ];
}

/** The acceptance target from docs/performance.md is a stable 90 FPS. */
const FRAME_RATE_FLOOR = 85;

function frameReading(state: ConductorState): ReadingText {
  const { framesPerSecond, p95Milliseconds } = state.status ?? {};
  if (framesPerSecond === undefined || p95Milliseconds === undefined) {
    return ["—", "idle"];
  }

  const text = `${Math.round(framesPerSecond)} fps · ${p95Milliseconds.toFixed(1)} ms p95`;
  if (!state.isLive) return [text, "idle"];

  return [text, framesPerSecond >= FRAME_RATE_FLOOR ? "live" : "warn"];
}

function createReading(root: HTMLElement, labelText: string): Reading {
  const element = document.createElement("span");
  element.className = "conductor__reading";

  const label = document.createElement("span");
  label.className = "conductor__reading-label";
  label.textContent = `${labelText} `;

  const value = document.createElement("output");
  value.textContent = "—";

  element.append(label, value);
  root.append(element);

  return {
    element,
    write(text, state): void {
      value.textContent = text;
      element.dataset.state = state;
    },
  };
}
