/**
 * Purpose: Answer "is everything all right" from across the room, in plain words.
 * Context: The station is run by front-of-house staff, not technicians.
 * Responsibility: Render the Sound, Picture, Controller, and Headset tiles,
 *   and the one banner a fault that needs a person deserves.
 * Boundary: The page decides what the readings mean; this only shows them.
 *   A reading names a value, never a word — which word says it is the copy's
 *   business. The numbers behind the words live in the technician drawer.
 */

import type { M5OperatorStatus } from "../m5/m5-adapter";
import type { XrSessionState } from "../world/xr-session";
import type { ConductorCopy, StatusValue } from "./conductor-copy";
import type { ConductorPanel } from "./conductor-state";

type ReadingState = "idle" | "live" | "warn" | "alarm";

interface Tile {
  readonly setLabel: (text: string) => void;
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

  const sound = createTile(root);
  const picture = createTile(root);
  const controller = createTile(root);
  const headset = createTile(root);
  tilesParent.append(root);

  // The one fault a front-of-house person must act on: a stranger's device is
  // answering on this station's address, so steering cannot be trusted.
  const banner = document.createElement("p");
  banner.className = "conductor__banner";
  banner.hidden = true;
  bannerParent.append(banner);

  let appliedCopy: ConductorCopy | undefined;

  return {
    update(state): void {
      const { snapshot, copy } = state;

      if (appliedCopy !== copy) {
        appliedCopy = copy;
        root.setAttribute("aria-label", copy.status.ariaLabel);
        sound.setLabel(copy.status.sound);
        picture.setLabel(copy.status.picture);
        controller.setLabel(copy.status.controller);
        headset.setLabel(copy.status.headset);
        banner.textContent = copy.status.wrongDeviceBanner;
      }

      const { values } = copy.status;
      writeTile(sound, values, soundReading(snapshot.audioState));
      writeTile(
        picture,
        values,
        pictureReading(snapshot.framesPerSecond, snapshot.xr),
      );
      writeTile(controller, values, controllerReading(snapshot.m5));
      writeTile(headset, values, headsetReading(snapshot.xr));

      banner.hidden = snapshot.m5?.state !== "wrong-device";
    },
  };
}

type Reading = readonly [value: StatusValue, state: ReadingState];

function writeTile(
  tile: Tile,
  values: Readonly<Record<StatusValue, string>>,
  [value, state]: Reading,
): void {
  tile.write(values[value], state);
}

/** Anything but "running" freezes show time; the wake overlay says how. */
function soundReading(audioState: AudioContextState): Reading {
  return audioState === "running" ? ["ok", "live"] : ["asleep", "warn"];
}

function headsetReading(xr: XrSessionState): Reading {
  if (xr.isSessionActive) return ["streaming", "live"];

  return xr.availability === "available" ? ["ready", "idle"] : ["none", "idle"];
}

/**
 * An absent adapter means a benchmark build; `off` means no host is set —
 * both read as "no device", which is a normal state, not a fault. A firmware
 * mismatch reads as "Check" so a drifted flash never hides behind a green OK;
 * the mismatch itself is spelled out in the technician drawer.
 */
function controllerReading(status: M5OperatorStatus | undefined): Reading {
  if (status === undefined || status.state === "off") return ["none", "idle"];
  if (status.state === "wrong-device") return ["check", "alarm"];
  if (status.state === "connecting") return ["connecting", "warn"];

  return status.hasFirmwareMismatch ? ["check", "warn"] : ["ok", "live"];
}

/** The acceptance target from docs/performance.md is a stable 90 FPS. */
const FRAME_RATE_FLOOR = 85;

/**
 * The rate is the one the world's single render loop is running at, and that
 * is the headset's only while a session presents. While the preview holds the
 * loop it is the station monitor's refresh — 60 Hz on an ordinary display,
 * below the floor by construction — so judging it there would light a warning
 * at every station all evening for a picture nobody is watching. Until the
 * headset takes the loop the tile therefore reports nothing; the raw rate
 * stays readable in the technician drawer either way.
 */
export function pictureReading(
  framesPerSecond: number | undefined,
  xr: XrSessionState,
): Reading {
  if (!xr.isSessionActive) return ["none", "idle"];
  if (framesPerSecond === undefined) return ["measuring", "idle"];

  return framesPerSecond >= FRAME_RATE_FLOOR
    ? ["ok", "live"]
    : ["check", "warn"];
}

function createTile(root: HTMLElement): Tile {
  const tile = document.createElement("div");
  tile.className = "conductor__tile";

  const dot = document.createElement("span");
  dot.className = "conductor__tile-dot";

  const body = document.createElement("div");
  body.className = "conductor__tile-body";

  const label = document.createElement("span");
  label.className = "conductor__tile-label";

  const value = document.createElement("output");
  value.className = "conductor__tile-value";
  value.textContent = "—";

  body.append(label, value);
  tile.append(dot, body);
  root.append(tile);

  return {
    setLabel(text): void {
      label.textContent = text;
    },
    write(text, state): void {
      value.textContent = text;
      tile.dataset.state = state;
    },
  };
}
