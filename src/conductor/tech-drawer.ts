/**
 * Purpose: Keep every control that can break a live show out of casual reach.
 * Context: Rehearsal speeds, resets, the page reload, the M5 host, and the
 *   raw readings are technician tools; front-of-house must not hit them by
 *   accident, so they live behind one deliberate toggle.
 * Responsibility: Own the drawer surface, the rehearsal and reset controls,
 *   and the raw readouts; offer mounts for the stage view and the M5 panel.
 * Boundary: The drawer slides rather than unmounts, so the world's canvas
 *   inside it keeps its layout size while hidden.
 */

import type { M5OperatorStatus } from "../m5/m5-adapter";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import { createButton, createConfirmButton } from "./panel-buttons";
import type { ShowActions } from "./show-actions";

export interface TechDrawerOptions {
  readonly parent: HTMLElement;
  readonly actions: ShowActions;
}

export interface TechDrawer {
  readonly toggle: () => void;
  /** Where the stage view panel mounts, above the controls. */
  readonly stageParent: HTMLElement;
  /** Where the M5 host panel mounts, below the resets. */
  readonly m5Parent: HTMLElement;
  readonly panel: ConductorPanel;
}

export function createTechDrawer({
  parent,
  actions,
}: TechDrawerOptions): TechDrawer {
  const root = document.createElement("aside");
  root.className = "conductor__drawer";
  root.dataset.open = "false";
  root.setAttribute("aria-label", "Technician tools");

  function toggle(): void {
    root.dataset.open = String(root.dataset.open !== "true");
  }

  const header = document.createElement("div");
  header.className = "conductor__drawer-header";
  const title = document.createElement("span");
  title.textContent = "Technician tools";
  header.append(title);
  const closeButton = createButton(header, "", toggle);
  closeButton.classList.add("conductor__drawer-close");
  closeButton.setAttribute("aria-label", "Close technician tools");
  closeButton.innerHTML = CLOSE_ICON_SVG;

  const caution = document.createElement("p");
  caution.className = "conductor__drawer-caution";
  caution.textContent =
    "These controls can interrupt a live show. Close this panel before handing the station back.";

  createGroup(root, undefined, [header, caution]);
  const stageParent = createGroup(root, "Stage view", []);

  const speeds = document.createElement("div");
  speeds.className = "conductor__speeds";
  const rateButtons = CONDUCTOR_SETTINGS.timeScales.map((timeScale) =>
    createButton(speeds, `${timeScale}×`, () =>
      actions.setTimeScale(timeScale),
    ),
  );
  createGroup(root, "Rehearsal speed", [speeds]);

  const resets = document.createElement("div");
  resets.className = "conductor__resets";
  createButton(resets, "Rewind to start and hold", () => actions.resetShow());
  createButton(resets, "Reset flight position", () => actions.resetFlight());
  const reloadButton = createConfirmButton(
    resets,
    "Reload the page",
    "Tap again to reload",
    () => actions.reloadShow(),
  );
  reloadButton.classList.add("conductor__reload-button");
  createGroup(root, "Resets", [resets]);

  const m5Parent = document.createElement("div");
  createGroup(root, "M5 controller", [m5Parent]);

  const readouts = document.createElement("div");
  readouts.className = "conductor__readouts";
  const frames = createReadout(readouts, "frames");
  const m5 = createReadout(readouts, "m5");
  const level = createReadout(readouts, "level");
  const audio = createReadout(readouts, "audio");
  const language = createReadout(readouts, "language");
  root.append(readouts);

  parent.append(root);

  return {
    toggle,
    stageParent,
    m5Parent,
    panel: {
      update(state): void {
        const { snapshot } = state;

        rateButtons.forEach((button, index) => {
          button.setAttribute(
            "aria-pressed",
            String(CONDUCTOR_SETTINGS.timeScales[index] === snapshot.timeScale),
          );
        });

        frames.write(
          frameText(snapshot.framesPerSecond, snapshot.p95Milliseconds),
        );
        m5.write(m5Text(snapshot.m5));
        level.write(snapshot.levelName);
        audio.write(snapshot.audioState);
        language.write(snapshot.language.toUpperCase());
      },
    },
  };
}

/** A titled block of the drawer; without a title it is just the block. */
function createGroup(
  root: HTMLElement,
  titleText: string | undefined,
  children: readonly HTMLElement[],
): HTMLElement {
  const group = document.createElement("div");
  group.className = "conductor__drawer-group";

  if (titleText !== undefined) {
    const heading = document.createElement("span");
    heading.className = "conductor__drawer-heading";
    heading.textContent = titleText;
    group.append(heading);
  }

  group.append(...children);
  root.append(group);
  return group;
}

interface Readout {
  readonly write: (text: string) => void;
}

function createReadout(parent: HTMLElement, labelText: string): Readout {
  const line = document.createElement("span");

  const label = document.createElement("span");
  label.textContent = `${labelText} `;

  const value = document.createElement("output");
  value.textContent = "—";

  line.append(label, value);
  parent.append(line);

  return {
    write(text): void {
      value.textContent = text;
    },
  };
}

function frameText(
  framesPerSecond: number | undefined,
  p95Milliseconds: number | undefined,
): string {
  if (framesPerSecond === undefined || p95Milliseconds === undefined) {
    return "—";
  }

  return `${Math.round(framesPerSecond)} fps · ${p95Milliseconds.toFixed(1)} ms p95`;
}

/**
 * The raw device reading the plain Controller tile summarizes: state, sample
 * quality, and the firmware-mismatch flag a drifted flash carries.
 */
function m5Text(status: M5OperatorStatus | undefined): string {
  if (status === undefined || status.state === "off") return "—";

  const mismatchSuffix = status.hasFirmwareMismatch ? " · fw!" : "";
  if (status.state === "wrong-device") return `wrong device${mismatchSuffix}`;
  if (status.state === "connecting") return `connecting${mismatchSuffix}`;

  const quality = status.quality?.toFixed(2) ?? "?";
  return `live · q${quality}${mismatchSuffix}`;
}

const CLOSE_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg>`;
