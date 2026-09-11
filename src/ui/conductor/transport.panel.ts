import type { Run } from "../../levels/run-contract";
import { requireElement, writeAttribute, writeText } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface TransportPanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly run: Pick<Run, "resetShowAndFlight" | "togglePlayback">;
}

/** Bind playback and immediate time/position reset to their existing owners. */
export function createTransportPanel({
  parent,
  signal,
  run,
}: TransportPanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__transport", HTMLElement);
  const transportButton = requireElement(
    root,
    ".conductor__transport-button",
    HTMLButtonElement,
  );
  const transportLabel = requireElement(
    transportButton,
    "[data-transport-label]",
    HTMLElement,
  );
  const playIcon = requireElement(
    transportButton,
    "[data-play-icon]",
    HTMLElement,
  );
  const pauseIcon = requireElement(
    transportButton,
    "[data-pause-icon]",
    HTMLElement,
  );
  transportButton.addEventListener("click", run.togglePlayback, { signal });
  const stopButton = requireElement(
    root,
    ".conductor__stop-button",
    HTMLButtonElement,
  );
  stopButton.disabled = false;
  stopButton.addEventListener("click", run.resetShowAndFlight, { signal });

  return {
    update(state): void {
      transportButton.disabled =
        state.playback === "loading" || state.playback === "ended";
      stopButton.disabled =
        state.playback === "loading" || state.playback === "ended";
      writeAttribute(transportButton, "data-playing", String(state.isPlaying));
      const canPause = state.isPlaying || state.playback === "buffering";
      playIcon.hidden = canPause;
      pauseIcon.hidden = !canPause;
      writeText(
        transportLabel,
        state.playback === "error" ? "Retry" : canPause ? "Pause" : "Play",
      );
    },
  };
}
