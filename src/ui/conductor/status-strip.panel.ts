import { requireElement, writeText } from "../shared/dom";
/**
 * Purpose: Answer "is everything all right" from across the room, in plain words.
 * Context: The station is run by front-of-house staff, not technicians.
 * Responsibility: Render the Sound, Picture, Controller, and Headset tiles,
 *   and the one banner a fault that needs a person deserves.
 * Boundary: These labels summarize observations; device validity stays in M5.
 *   The numbers behind the words live in the technician drawer.
 */

import type { M5OperatorStatus } from "../../m5/m5-adapter";
import type { XrSessionState } from "../../world/xr-session";
import type { ConductorPanel, ConductorViewState } from "./view-state";

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
  const root = requireElement(tilesParent, ".conductor__tiles", HTMLElement);
  const sound = bindTile(root, "sound");
  const picture = bindTile(root, "picture");
  const controller = bindTile(root, "controller");
  const headset = bindTile(root, "headset");
  const banner = requireElement(bannerParent, ".conductor__banner", HTMLElement);

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

function bindTile(root: HTMLElement, name: string): Tile {
  const tile = requireElement(root, `[data-tile="${name}"]`, HTMLElement);
  const output = requireElement(tile, "output", HTMLOutputElement);
  return {
    write(text, state): void {
      writeText(output, text);
      if (tile.dataset.state !== state) tile.dataset.state = state;
    },
  };
}
