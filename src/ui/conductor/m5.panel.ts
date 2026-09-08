import { requireElement, writeText } from "../shared/dom";
import type { Run } from "../../levels/level.runtime";
import type { M5State } from "../../m5/protocol";
import type { ConductorPanel } from "./view-state";


export interface M5PanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly m5: Pick<NonNullable<Run["m5"]>, "readLatestState"> | undefined;
  readonly initialHost: string;
  readonly isHostLocked: boolean;
  readonly onHostChange: (host: string) => void;
}

export function createM5Panel({
  parent,
  signal,
  m5,
  initialHost,
  isHostLocked,
  onHostChange,
}: M5PanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__m5", HTMLElement);
  const host = requireElement(root, "input", HTMLInputElement);
  host.value = initialHost;
  host.readOnly = isHostLocked;
  host.title = isHostLocked ? "Set by the station's deployment config" : "";
  const preview = bindPreview(root, () => m5?.readLatestState());
  preview.setHost(initialHost);
  const apply = requireElement(root, "[data-set-host]", HTMLButtonElement);
  const clear = requireElement(root, "[data-clear-host]", HTMLButtonElement);
  apply.hidden = isHostLocked;
  clear.hidden = isHostLocked;
  function applyHost(nextHost: string): void {
    onHostChange(nextHost);
    preview.setHost(nextHost);
  }
  if (!isHostLocked) {
    apply.addEventListener("click", () => applyHost(host.value.trim()), { signal });
    clear.addEventListener("click", () => { host.value = ""; applyHost(""); }, { signal });
    host.addEventListener("keydown", (event) => {
      if (event.key === "Enter") applyHost(host.value.trim());
    }, { signal });
  }

  return {
    update(): void {
      preview.render();
    },
  };
}

interface M5Preview {
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
function bindPreview(root: HTMLElement, readState: () => M5State | undefined): M5Preview {
  const element = requireElement(root, ".conductor__m5-preview", HTMLElement);
  const dot = requireElement(element, ".conductor__m5-dot", SVGCircleElement);
  const readout = requireElement(element, ".conductor__m5-readout", HTMLElement);

  return {

    setHost(host) {
      element.hidden = host.length === 0;
    },

    render() {
      const state = readState();
      element.dataset.live = String(state !== undefined);

      if (state === undefined) {
        dot.setAttribute("cx", "50");
        dot.setAttribute("cy", "50");
        writeText(readout, "no signal");
        return;
      }

      // Half the pad minus a margin keeps full deflection inside the ring.
      const roll = clamp(state.roll, -1, 1);
      const pitch = clamp(state.pitch, -1, 1);
      dot.setAttribute("cx", String(50 + roll * 42));
      dot.setAttribute("cy", String(50 - pitch * 42));
      writeText(readout, `P ${pitch.toFixed(2)} · R ${roll.toFixed(2)} · q${state.quality.toFixed(1)}`);
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
