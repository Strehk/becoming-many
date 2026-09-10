import type { M5Observation } from "../../m5/m5-contract";
import { requireElement, writeText } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface M5PanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly initialHost: string;
  readonly isHostLocked: boolean;
  readonly onHostChange: (host: string) => void;
}

export function createM5Panel({
  parent,
  signal,
  initialHost,
  isHostLocked,
  onHostChange,
}: M5PanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__m5", HTMLElement);
  const host = requireElement(root, "input", HTMLInputElement);
  host.value = initialHost;
  host.readOnly = isHostLocked;
  host.title = isHostLocked ? "Set by the station's deployment config" : "";
  const preview = bindPreview(root);
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
    apply.addEventListener("click", () => applyHost(host.value.trim()), {
      signal,
    });
    clear.addEventListener(
      "click",
      () => {
        host.value = "";
        applyHost("");
      },
      { signal },
    );
    host.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") applyHost(host.value.trim());
      },
      { signal },
    );
  }

  return {
    update(state): void {
      preview.render(state.m5);
    },
  };
}

interface M5Preview {
  /** An empty host hides the pad; the samples come from the show either way. */
  readonly setHost: (host: string) => void;
  /** Called from the page's redraw; positions the dot from the last sample. */
  readonly render: (observation: M5Observation | undefined) => void;
}

/** Display the accepted device sample separately from effective steering quality. */
function bindPreview(root: HTMLElement): M5Preview {
  const element = requireElement(root, ".conductor__m5-preview", HTMLElement);
  const dot = requireElement(element, ".conductor__m5-dot", SVGCircleElement);
  const readout = requireElement(
    element,
    ".conductor__m5-readout",
    HTMLElement,
  );

  return {
    setHost(host) {
      element.hidden = host.length === 0;
    },

    render(observation) {
      const state = observation?.sample;
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
      writeText(
        readout,
        `P ${pitch.toFixed(2)} · R ${roll.toFixed(2)} · sample q${state.quality.toFixed(1)} · input q${(observation?.control?.quality ?? 0).toFixed(1)}`,
      );
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
