/**
 * Purpose: Let the operator point the show at the station's M5 controller.
 * Context: The device is an HTTP server on the station network; only the
 *   conductor knows which host belongs to this station.
 * Responsibility: Edit and send the M5 host, remember it across page loads,
 *   re-arm a reloaded show window, and preview the device's orientation on a
 *   crosshair with the page's own slow poll.
 * Boundary: Steering and warnings live in the show; the status strip renders
 *   the show-side device state. The preview never feeds the pipeline.
 */

import type { M5State } from "../m5/protocol";
import { createStatePoller } from "../m5/state-polling";
import type { ShowCommand } from "../station/station-protocol";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";

// The station's host is a technician convenience remembered per browser, like
// the flash page's credentials — not authored configuration.
const STORAGE_KEY = "bm-conductor-m5-host";

export interface M5PanelOptions {
  readonly parent: HTMLElement;
  readonly send: (command: ShowCommand) => void;
  /**
   * Host named by the deployment config. Set, the field renders it read-only
   * and this panel sends nothing: the show applies the same config itself,
   * and the station drops setM5Host commands while locked.
   */
  readonly lockedHost?: string;
}

export function createM5Panel({
  parent,
  send,
  lockedHost,
}: M5PanelOptions): ConductorPanel {
  const root = document.createElement("section");
  root.className = "conductor__m5";
  root.setAttribute("aria-label", "M5 controller");

  const label = document.createElement("label");
  label.className = "conductor__m5-label";
  label.textContent = "M5 host";

  const host = document.createElement("input");
  host.type = "text";
  host.placeholder = "bm-station-a-m5.local";
  host.value = lockedHost ?? loadStoredHost();
  host.readOnly = lockedHost !== undefined;
  if (lockedHost !== undefined) {
    host.title = "Set by the station's deployment config";
  }
  label.append(host);

  const preview = createPreview();

  if (lockedHost !== undefined) {
    root.append(label, preview.element);
    parent.append(root);
    preview.watch(lockedHost);

    return {
      update(): void {
        preview.render();
      },
    };
  }

  const apply = document.createElement("button");
  apply.type = "button";
  apply.textContent = "Set";

  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear";

  root.append(label, apply, clear, preview.element);
  parent.append(root);

  const sendHost = (nextHost: string): void => {
    saveStoredHost(nextHost);
    send({ kind: "setM5Host", host: nextHost });
    preview.watch(nextHost);
  };

  apply.addEventListener("click", () => sendHost(host.value.trim()));
  clear.addEventListener("click", () => {
    host.value = "";
    sendHost("");
  });
  host.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendHost(host.value.trim());
  });

  // The preview is this page's own poll: it starts from the stored host right
  // away, before (and regardless of) any show window being connected.
  preview.watch(host.value.trim());

  // The show's presence last frame, so a reloaded show window gets the stored
  // host re-sent exactly once per connection — a show remembers nothing across
  // reloads by design.
  let wasShowConnected = false;

  return {
    update(state): void {
      if (state.isShowConnected && !wasShowConnected) {
        const storedHost = loadStoredHost();
        if (storedHost.length > 0) sendHost(storedHost);
      }
      wasShowConnected = state.isShowConnected;

      apply.disabled = !state.isShowConnected;
      clear.disabled = !state.isShowConnected;
      preview.render();
    },
  };
}

interface M5Preview {
  readonly element: HTMLElement;
  /** Poll `host` at the preview rate; an empty host stops and hides the pad. */
  readonly watch: (host: string) => void;
  /** Called from the page's redraw; positions the dot from the last sample. */
  readonly render: () => void;
}

/**
 * A crosshair pad with one dot: roll deflects it sideways, pitch deflects it
 * up (positive pitch climbs, so the dot rises). Stale or missing samples park
 * the dot at center and dim the pad.
 */
function createPreview(): M5Preview {
  const element = document.createElement("div");
  element.className = "conductor__m5-preview";
  element.hidden = true;

  const pad = document.createElement("div");
  pad.className = "conductor__m5-pad";
  const dot = document.createElement("div");
  dot.className = "conductor__m5-dot";
  pad.append(dot);

  const readout = document.createElement("span");
  readout.className = "conductor__m5-readout";

  element.append(pad, readout);

  let lastState: M5State | null = null;
  let lastSampleAtMilliseconds = 0;

  const poller = createStatePoller(
    CONDUCTOR_SETTINGS.m5PreviewIntervalMilliseconds,
    (state) => {
      lastState = state;
      lastSampleAtMilliseconds = performance.now();
    },
  );

  return {
    element,

    watch(host) {
      lastState = null;
      element.hidden = host.length === 0;
      poller.watch(host);
    },

    render() {
      const isFresh =
        lastState !== null &&
        performance.now() - lastSampleAtMilliseconds <
          CONDUCTOR_SETTINGS.m5PreviewStaleMilliseconds;
      element.dataset.live = String(isFresh);

      if (!isFresh || lastState === null) {
        dot.style.left = "50%";
        dot.style.top = "50%";
        readout.textContent = "no signal";
        return;
      }

      // Half the pad minus a margin keeps full deflection inside the ring.
      const roll = clamp(lastState.roll, -1, 1);
      const pitch = clamp(lastState.pitch, -1, 1);
      dot.style.left = `${50 + roll * 42}%`;
      dot.style.top = `${50 - pitch * 42}%`;
      readout.textContent = `P ${pitch.toFixed(2)} · R ${roll.toFixed(2)} · q${lastState.quality.toFixed(1)}`;
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadStoredHost(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveStoredHost(host: string): void {
  try {
    if (host.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, host);
  } catch {
    // A browser refusing storage only loses the convenience.
  }
}
