/**
 * Purpose: Answer "is everything all right" from across the room, in plain words.
 * Context: The station is run by front-of-house staff, not technicians.
 * Responsibility: Render the Sound, Picture, Controller, and Headset tiles,
 *   and the one banner a fault that needs a person deserves.
 * Boundary: These labels summarize observations; device validity stays in M5.
 *   The numbers behind the words live in the technician drawer.
 */

import type { M5OperatorStatus } from "../m5/m5-adapter";
import type { XrSessionState } from "../world/xr-session";
import type { ConductorPanel, ConductorViewState } from "./conductor-state";

type ReadingState = "idle" | "live" | "warn" | "alarm";

interface Tile {
  readonly write: (text: string, state: ReadingState) => void;
}

export interface StatusStripOptions {
  /** The masthead row the tiles sit in, beside the station identity. */
  readonly tilesParent: HTMLElement;
  /** The page column the fault banner drops into, under the masthead. */
  readonly bannerParent: HTMLElement;
}

export function createStatusStrip({
  tilesParent,
  bannerParent,
}: StatusStripOptions): ConductorPanel {
  const root = document.createElement("div");
  root.className = "conductor__tiles";
  root.setAttribute("aria-label", "Station status");

  const sound = createTile(root, "Sound");
  const picture = createTile(root, "Picture");
  const controller = createTile(root, "Controller");
  const headset = createTile(root, "Headset");
  tilesParent.append(root);

  // The one fault a front-of-house person must act on: a stranger's device is
  // answering on this station's address, so steering cannot be trusted.
  const banner = document.createElement("p");
  banner.className = "conductor__banner";
  banner.hidden = true;
  banner.textContent =
    "The hand controller is not answering as this station's own. The show keeps playing — call a technician before the next visitor steers.";
  bannerParent.append(banner);

  return {
    update(state): void {
      sound.write(...soundReading(state.audioState));
      picture.write(...pictureReading(state));
      controller.write(...controllerReading(state.m5));
      headset.write(...headsetReading(state.xr));

      banner.hidden = state.m5?.state !== "wrong-device";
    },
  };
}

type ReadingText = readonly [text: string, state: ReadingState];

/** Anything but "running" freezes show time; the wake overlay says how. */
function soundReading(audioState: AudioContextState): ReadingText {
  return audioState === "running" ? ["OK", "live"] : ["Asleep", "warn"];
}

function headsetReading(xr: XrSessionState): ReadingText {
  if (xr.isSessionActive) return ["Streaming", "live"];

  return xr.availability === "available" ? ["Ready", "idle"] : ["—", "idle"];
}

/**
 * An absent adapter means a benchmark build; `off` means no host is set —
 * both read as "no device", which is a normal state, not a fault. A
 * rejected sample reads as "Check"; the technician drawer names the reason.
 */
function controllerReading(status: M5OperatorStatus | undefined): ReadingText {
  if (status === undefined || status.state === "off") return ["—", "idle"];
  if (status.state === "wrong-device") return ["Check", "alarm"];
  if (status.state === "connecting") return ["Connecting", "warn"];

  return status.state === "live" ? ["OK", "live"] : ["Check", "warn"];
}

/** The acceptance target from docs/performance.md is a stable 90 FPS. */
const FRAME_RATE_FLOOR = 85;

function pictureReading(state: ConductorViewState): ReadingText {
  const { framesPerSecond } = state;
  if (framesPerSecond === undefined) return ["—", "idle"];

  return framesPerSecond >= FRAME_RATE_FLOOR
    ? ["OK", "live"]
    : ["Check", "warn"];
}

function createTile(root: HTMLElement, labelText: string): Tile {
  const tile = document.createElement("div");
  tile.className = "conductor__tile";

  const dot = document.createElement("span");
  dot.className = "conductor__tile-dot";

  const body = document.createElement("div");
  body.className = "conductor__tile-body";

  const label = document.createElement("span");
  label.className = "conductor__tile-label";
  label.textContent = labelText;

  const value = document.createElement("output");
  value.className = "conductor__tile-value";
  value.textContent = "—";

  body.append(label, value);
  tile.append(dot, body);
  root.append(tile);

  return {
    write(text, state): void {
      value.textContent = text;
      tile.dataset.state = state;
    },
  };
}
