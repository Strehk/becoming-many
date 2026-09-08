/**
 * Purpose: Keep every control that can break a live show out of casual reach.
 * Context: Rehearsal speeds, resets, the page reload, the M5 host, and the
 *   raw readings are technician tools; front-of-house must not hit them by
 *   accident, so they live behind one deliberate toggle.
 * Responsibility: Own the drawer surface, the rehearsal and reset controls,
 *   the page's own language, and the raw readouts; offer mounts for the stage
 *   view and the M5 panel.
 * Boundary: The drawer slides rather than unmounts, so the world's canvas
 *   inside it keeps its layout size while hidden.
 */

import type { M5OperatorStatus } from "../m5/m5-adapter";
import {
  type ConductorCopy,
  OPERATOR_LANGUAGES,
  type OperatorLanguage,
} from "./conductor-copy";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import { createButton, createConfirmButton } from "./panel-buttons";
import type { ShowActions } from "./show-actions";

export interface TechDrawerOptions {
  readonly parent: HTMLElement;
  readonly actions: ShowActions;
  /**
   * Change the language this page is read in. It is a technician's setting
   * because the venue decides it once, not the operator per visitor — the
   * session bar's language switch is the visitor's narration.
   */
  readonly onSetLanguage: (language: OperatorLanguage) => void;
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
  onSetLanguage,
}: TechDrawerOptions): TechDrawer {
  const root = document.createElement("aside");
  root.className = "conductor__drawer";
  root.dataset.open = "false";

  function toggle(): void {
    root.dataset.open = String(root.dataset.open !== "true");
  }

  const header = document.createElement("div");
  header.className = "conductor__drawer-header";
  const title = document.createElement("span");
  header.append(title);
  const closeButton = createButton(header, "", toggle);
  closeButton.classList.add("conductor__drawer-close");
  closeButton.innerHTML = CLOSE_ICON_SVG;

  const caution = document.createElement("p");
  caution.className = "conductor__drawer-caution";

  createGroup(root, [header, caution]);
  const stageGroup = createGroup(root, []);
  const stageParent = stageGroup.element;

  const speeds = document.createElement("div");
  speeds.className = "conductor__speeds";
  const rateButtons = CONDUCTOR_SETTINGS.timeScales.map((timeScale) =>
    createButton(speeds, `${timeScale}×`, () =>
      actions.setTimeScale(timeScale),
    ),
  );
  const speedGroup = createGroup(root, [speeds]);

  const resets = document.createElement("div");
  resets.className = "conductor__resets";
  const rewindButton = createButton(resets, "", () => actions.resetShow());
  const flightButton = createButton(resets, "", () => actions.resetFlight());
  const reloadButton = createConfirmButton(resets, () => actions.reloadShow());
  reloadButton.element.classList.add("conductor__reload-button");
  const resetGroup = createGroup(root, [resets]);

  // The page's own language. It sits with the technician's settings because a
  // venue fixes it once; a wrong tap here changes no show state at all.
  const languages = document.createElement("div");
  languages.className = "conductor__page-languages";
  const languageButtons = OPERATOR_LANGUAGES.map((operatorLanguage) =>
    createButton(languages, operatorLanguage.toUpperCase(), () =>
      onSetLanguage(operatorLanguage),
    ),
  );
  const languageGroup = createGroup(root, [languages]);

  const m5Parent = document.createElement("div");
  const m5Group = createGroup(root, [m5Parent]);

  const readouts = document.createElement("div");
  readouts.className = "conductor__readouts";
  const frames = createReadout(readouts);
  const m5 = createReadout(readouts);
  const level = createReadout(readouts);
  const audio = createReadout(readouts);
  const language = createReadout(readouts);
  root.append(readouts);

  parent.append(root);

  let appliedCopy: ConductorCopy | undefined;

  function applyCopy(copy: ConductorCopy): void {
    root.setAttribute("aria-label", copy.drawer.title);
    title.textContent = copy.drawer.title;
    closeButton.setAttribute("aria-label", copy.drawer.close);
    caution.textContent = copy.drawer.caution;

    stageGroup.setTitle(copy.drawer.stageView);
    speedGroup.setTitle(copy.drawer.rehearsalSpeed);
    resetGroup.setTitle(copy.drawer.resets);
    languageGroup.setTitle(copy.drawer.pageLanguage);
    m5Group.setTitle(copy.drawer.m5);

    rewindButton.textContent = copy.drawer.rewind;
    flightButton.textContent = copy.drawer.resetFlight;
    reloadButton.setLabels(copy.drawer.reload, copy.drawer.reloadArmed);

    frames.setLabel(copy.drawer.readouts.frames);
    m5.setLabel(copy.drawer.readouts.m5);
    level.setLabel(copy.drawer.readouts.level);
    audio.setLabel(copy.drawer.readouts.audio);
    language.setLabel(copy.drawer.readouts.language);
  }

  return {
    toggle,
    stageParent,
    m5Parent,
    panel: {
      update(state): void {
        const { snapshot, copy } = state;

        if (appliedCopy !== copy) {
          appliedCopy = copy;
          applyCopy(copy);
        }

        languageButtons.forEach((button, index) => {
          button.setAttribute(
            "aria-pressed",
            String(OPERATOR_LANGUAGES[index] === copy.language),
          );
        });

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

interface DrawerGroup {
  readonly element: HTMLElement;
  /** A group without a title keeps its heading empty and hidden. */
  readonly setTitle: (text: string) => void;
}

/** A titled block of the drawer; untitled until something names it. */
function createGroup(
  root: HTMLElement,
  children: readonly HTMLElement[],
): DrawerGroup {
  const group = document.createElement("div");
  group.className = "conductor__drawer-group";

  const heading = document.createElement("span");
  heading.className = "conductor__drawer-heading";
  heading.hidden = true;
  group.append(heading, ...children);
  root.append(group);

  return {
    element: group,
    setTitle(text): void {
      heading.textContent = text;
      heading.hidden = false;
    },
  };
}

interface Readout {
  readonly setLabel: (text: string) => void;
  readonly write: (text: string) => void;
}

function createReadout(parent: HTMLElement): Readout {
  const line = document.createElement("span");

  const label = document.createElement("span");

  const value = document.createElement("output");
  value.textContent = "—";

  line.append(label, value);
  parent.append(line);

  return {
    setLabel(text): void {
      label.textContent = `${text} `;
    },
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
