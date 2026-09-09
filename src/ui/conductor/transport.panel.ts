import type { Run } from "../../levels/level.runtime";
import type { RunningShow } from "../../levels/show.runtime";
import { requireElement, writeText } from "../shared/dom";
import { formatTutorialStatus } from "../shared/show-time-format";
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
  const tutorialStatus = requireElement(
    root,
    "[data-tutorial-status]",
    HTMLOutputElement,
  );
  requireElement(
    root,
    ".conductor__stop-button",
    HTMLButtonElement,
  ).addEventListener("click", run.resetShowAndFlight, { signal });
  let renderedPlaying: boolean | undefined;

  return {
    update(state): void {
      tutorialStatus.hidden = !state.tutorial;
      if (state.tutorial)
        writeText(tutorialStatus, formatTutorialStatus(state.tutorial));
      if (renderedPlaying === state.isPlaying) return;
      renderedPlaying = state.isPlaying;
      transportButton.dataset.playing = String(state.isPlaying);
      playIcon.hidden = state.isPlaying;
      pauseIcon.hidden = !state.isPlaying;
      transportLabel.textContent = state.isPlaying ? "Pause" : "Play";
    },
  };
}
