/**
 * Purpose: Answer "is everything all right" from across the room.
 * Context: A suspended audio context freezes show time and looks like a pause.
 * Responsibility: Render audio, frame rate, M5, level, and language readings.
 * Boundary: The page decides what the readings mean; this only shows them.
 */

import type { M5OperatorStatus } from "../m5/m5-adapter";
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

  const audio = createReading(root, "audio");
  const frames = createReading(root, "frames");
  const m5 = createReading(root, "m5");
  const level = createReading(root, "level");
  const language = createReading(root, "language");

  // Show time derives from the audio clock, so a context that never received
  // a gesture freezes the piece while looking exactly like a pause. Any click
  // or key press on this page clears it — the restart button counts.
  const banner = document.createElement("p");
  banner.className = "conductor__banner";
  banner.hidden = true;
  parent.append(root, banner);

  banner.textContent =
    "Show time is frozen: click anywhere or press any key to start the audio clock.";

  return {
    update(state): void {
      const { snapshot } = state;

      audio.write(
        snapshot.audioState,
        snapshot.audioState === "running" ? "live" : "warn",
      );
      frames.write(...frameReading(state));
      m5.write(...m5Reading(snapshot.m5));
      level.write(snapshot.levelName, "idle");
      language.write(snapshot.language.toUpperCase(), "idle");

      banner.hidden = snapshot.audioState === "running";
    },
  };
}

type ReadingText = readonly [text: string, state: ReadingState];

/**
 * An absent adapter means a benchmark build; `off` means no host is set —
 * both read as "no device", which is a normal state, not a fault. A firmware
 * mismatch is appended so a drifted flash never hides behind a green "live".
 */
function m5Reading(status: M5OperatorStatus | undefined): ReadingText {
  if (status === undefined || status.state === "off") return ["—", "idle"];

  const mismatchSuffix = status.hasFirmwareMismatch ? " · fw!" : "";
  if (status.state === "wrong-device") {
    return [`wrong device${mismatchSuffix}`, "alarm"];
  }
  if (status.state === "connecting") {
    return [`connecting${mismatchSuffix}`, "warn"];
  }

  const quality = status.quality?.toFixed(2) ?? "?";
  return [
    `live · q${quality}${mismatchSuffix}`,
    status.hasFirmwareMismatch ? "warn" : "live",
  ];
}

/** The acceptance target from docs/performance.md is a stable 90 FPS. */
const FRAME_RATE_FLOOR = 85;

function frameReading(state: ConductorState): ReadingText {
  const { framesPerSecond, p95Milliseconds } = state.snapshot;
  if (framesPerSecond === undefined || p95Milliseconds === undefined) {
    return ["—", "idle"];
  }

  const text = `${Math.round(framesPerSecond)} fps · ${p95Milliseconds.toFixed(1)} ms p95`;

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
