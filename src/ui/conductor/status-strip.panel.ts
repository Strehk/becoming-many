import type { M5Observation } from "../../m5/runtime/m5.runtime";
import type { XrSessionState } from "../../world/xr-session";
import { requireElement, writeText } from "../shared/dom";
import type { ConductorPanel, ConductorViewState } from "./view-state";

type ReadingState = "idle" | "live" | "warn";

interface Tile {
  readonly write: (text: string, state: ReadingState) => void;
}

export interface StatusStripOptions {
  /** The masthead row the tiles sit in, beside the station identity. */
  readonly tilesParent: HTMLElement;
}

export function createStatusStrip({
  tilesParent,
}: StatusStripOptions): ConductorPanel {
  const root = requireElement(tilesParent, ".conductor__tiles", HTMLElement);
  const sound = bindTile(root, "sound");
  const picture = bindTile(root, "picture");
  const controller = bindTile(root, "controller");
  const headset = bindTile(root, "headset");

  return {
    update(state): void {
      sound.write(...soundReading(state.audioState));
      picture.write(...pictureReading(state));
      controller.write(...controllerReading(state.m5));
      headset.write(...headsetReading(state.xr));
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
 * live reply supplies steering; metadata stays in the technician drawer.
 */
function controllerReading(status: M5Observation | undefined): ReadingText {
  if (status === undefined || status.status === "off") return ["—", "idle"];
  if (status.status === "connecting") return ["Connecting", "warn"];

  return (status.control?.quality ?? 0) > 0
    ? ["OK", "live"]
    : ["Neutral", "idle"];
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
