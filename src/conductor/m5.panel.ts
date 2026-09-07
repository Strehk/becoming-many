import type { Run } from "../levels/level.runtime";
import type { M5State } from "../m5/protocol";
import type { ConductorPanel } from "./conductor-state";

export interface M5PanelOptions {
  readonly parent: HTMLElement;
  readonly m5: Pick<NonNullable<Run["m5"]>, "readLatestState"> | undefined;
  readonly initialHost: string;
  readonly isHostLocked: boolean;
  readonly onHostChange: (host: string) => void;
}

export function createM5Panel({
  parent,
  m5,
  initialHost,
  isHostLocked,
  onHostChange,
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
  host.value = initialHost;
  host.readOnly = isHostLocked;
  if (isHostLocked) {
    host.title = "Set by the station's deployment config";
  }
  label.append(host);

  const preview = createPreview(() => m5?.readLatestState());
  preview.setHost(initialHost);

  const applyHost = (nextHost: string): void => {
    onHostChange(nextHost);
    preview.setHost(nextHost);
  };

  root.append(label);
  if (!isHostLocked) {
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Set";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    root.append(apply, clear);
    apply.addEventListener("click", () => applyHost(host.value.trim()));
    clear.addEventListener("click", () => {
      host.value = "";
      applyHost("");
    });
    host.addEventListener("keydown", (event) => {
      if (event.key === "Enter") applyHost(host.value.trim());
    });
  }
  root.append(preview.element);
  parent.append(root);

  return {
    update(): void {
      preview.render();
    },
  };
}

interface M5Preview {
  readonly element: HTMLElement;
  /** An empty host hides the pad; the samples come from the show either way. */
  readonly setHost: (host: string) => void;
  /** Called from the page's redraw; positions the dot from the last sample. */
  readonly render: () => void;
}

/**
 * A crosshair pad with one dot: roll deflects it sideways, pitch deflects it
 * up (positive pitch climbs, so the dot rises). `readState` is the show's
 * newest sample; it yields nothing while the device is stale, missing, or the
 * wrong one, which parks the dot at center and dims the pad.
 */
function createPreview(readState: () => M5State | undefined): M5Preview {
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

  return {
    element,

    setHost(host) {
      element.hidden = host.length === 0;
    },

    render() {
      const state = readState();
      element.dataset.live = String(state !== undefined);

      if (state === undefined) {
        dot.style.left = "50%";
        dot.style.top = "50%";
        readout.textContent = "no signal";
        return;
      }

      // Half the pad minus a margin keeps full deflection inside the ring.
      const roll = clamp(state.roll, -1, 1);
      const pitch = clamp(state.pitch, -1, 1);
      dot.style.left = `${50 + roll * 42}%`;
      dot.style.top = `${50 - pitch * 42}%`;
      readout.textContent = `P ${pitch.toFixed(2)} · R ${roll.toFixed(2)} · q${state.quality.toFixed(1)}`;
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
