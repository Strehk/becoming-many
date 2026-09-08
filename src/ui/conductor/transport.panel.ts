import type { Run } from "../../levels/level.runtime";
import type { RunningShow } from "../../levels/show.runtime";
import { requireElement } from "../shared/dom";
import type { ConductorPanel } from "./view-state";

export interface TransportPanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly show: Pick<RunningShow, "togglePlayback">;
  readonly run: Pick<Run, "resetShowAndFlight">;
}

/** Bind playback and immediate time/position reset to their existing owners. */
export function createTransportPanel({
  parent,
  signal,
  show,
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
  transportButton.addEventListener("click", show.togglePlayback, { signal });
  requireElement(
    root,
    ".conductor__stop-button",
    HTMLButtonElement,
  ).addEventListener("click", run.resetShowAndFlight, { signal });
  let renderedPlaying: boolean | undefined;

  return {
    update(state): void {
      if (renderedPlaying === state.isPlaying) return;
      renderedPlaying = state.isPlaying;
      transportButton.dataset.playing = String(state.isPlaying);
      playIcon.hidden = state.isPlaying;
      pauseIcon.hidden = !state.isPlaying;
      transportLabel.textContent = state.isPlaying ? "Pause" : "Play";
    },
  };
}
