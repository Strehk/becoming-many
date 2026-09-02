/**
 * Purpose: Draw the schedule against show time and let the operator scrub it.
 * Context: Cue slots and recording lengths are what a conductor retimes by ear.
 * Responsibility: Render slots, recordings, and the playhead, and seek on drag.
 * Boundary: Slot arithmetic belongs to the dramaturgy layout, never to this file.
 */

import type { NarrationCueId } from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { type CueSlot, cueSlots } from "../dramaturgy/schedule-layout";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import type { ShowActions } from "./show-actions";

const MILLISECONDS_PER_SECOND = 1_000;
const RULER_INTERVAL_SECONDS = 60;

export interface ShowTimelineOptions {
  readonly parent: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly actions: ShowActions;
  /** Reports the operator's own position, or undefined when the drag ends. */
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
  readonly onSelectCue: (cueId: NarrationCueId) => void;
}

interface SlotView {
  readonly cueId: NarrationCueId;
  readonly element: HTMLElement;
  readonly recording: HTMLElement;
}

export function createShowTimeline({
  parent,
  schedule,
  actions,
  onScrubChange,
  onSelectCue,
}: ShowTimelineOptions): ConductorPanel {
  const { durationSeconds } = schedule;
  const root = document.createElement("section");
  root.className = "conductor__timeline";
  root.setAttribute("aria-label", "Show timeline");

  root.append(createRuler(durationSeconds));

  const track = document.createElement("div");
  track.className = "timeline__track";
  const slots = cueSlots(schedule, "en").map((slot) =>
    createSlot(track, slot, durationSeconds, onSelectCue),
  );

  const playhead = document.createElement("div");
  playhead.className = "timeline__playhead";
  track.append(playhead);
  root.append(track);

  root.append(createJumps(schedule, actions));
  parent.append(root);

  attachScrubbing({ track, durationSeconds, actions, onScrubChange });

  let renderedLanguage: string | undefined;

  return {
    update(state): void {
      if (renderedLanguage !== state.snapshot.language) {
        renderedLanguage = state.snapshot.language;
        // Only the recordings change with the language; the slots are shared.
        cueSlots(schedule, state.snapshot.language).forEach((slot, index) => {
          writeRecording(slots[index]?.recording, slot);
        });
      }

      // The scrub gesture reads this to know whether to resume afterwards.
      track.dataset.playing = String(state.snapshot.isPlaying);
      playhead.style.left = `${toPercent(state.showTimeSeconds, durationSeconds)}%`;
      for (const slot of slots) {
        slot.element.setAttribute(
          "aria-selected",
          String(slot.cueId === state.selectedCueId),
        );
      }
    },
  };
}

function createRuler(durationSeconds: number): HTMLElement {
  const ruler = document.createElement("div");
  ruler.className = "timeline__ruler";

  for (
    let atSeconds = 0;
    atSeconds < durationSeconds;
    atSeconds += RULER_INTERVAL_SECONDS
  ) {
    const tick = document.createElement("span");
    tick.className = "timeline__tick";
    tick.style.left = `${toPercent(atSeconds, durationSeconds)}%`;
    tick.textContent = `${atSeconds / RULER_INTERVAL_SECONDS}:00`;
    ruler.append(tick);
  }

  return ruler;
}

function createSlot(
  track: HTMLElement,
  slot: CueSlot,
  durationSeconds: number,
  onSelectCue: (cueId: NarrationCueId) => void,
): SlotView {
  const element = document.createElement("div");
  element.className = "timeline__slot";
  // Placed at its own cue time rather than tiled from the left, so silence in
  // the schedule — the lead-in before the first word, or any later gap — shows
  // as empty track instead of sliding every cue earlier than it plays.
  element.style.left = `${toPercent(slot.atSeconds, durationSeconds)}%`;
  element.style.width = `${toPercent(slot.slotSeconds, durationSeconds)}%`;
  element.setAttribute("role", "option");
  element.setAttribute("aria-selected", "false");

  const name = document.createElement("span");
  name.className = "timeline__slot-name";
  name.textContent = slot.cueId;

  const recording = document.createElement("div");
  recording.className = "timeline__recording";
  writeRecording(recording, slot);

  element.append(name, recording);
  element.addEventListener("pointerdown", () => onSelectCue(slot.cueId));
  track.append(element);

  return { cueId: slot.cueId, element, recording };
}

/**
 * The filled bar is the recording; the gap to the slot's right edge is the
 * silence before the next cue. A recording that outlasts its slot fills the
 * whole width and is marked, because the successor would cut it off.
 */
function writeRecording(
  recording: HTMLElement | undefined,
  slot: CueSlot,
): void {
  if (!recording) return;

  const filled = Math.min(slot.recordingSeconds / slot.slotSeconds, 1);
  recording.style.width = `${filled * 100}%`;
  recording.dataset.overrun = String(slot.headroomSeconds < 0);
}

function createJumps(
  schedule: NarrationSchedule,
  actions: ShowActions,
): HTMLElement {
  const jumps = document.createElement("div");
  jumps.className = "conductor__jumps";

  schedule.narration.forEach((cue, index) => {
    const button = document.createElement("button");
    button.type = "button";
    // The label matches the digit key that reaches the same cue.
    button.textContent = `${index + 1} ${cue.cueId}`;
    button.addEventListener("click", () => actions.seekTo(cue.atSeconds));
    jumps.append(button);
  });

  return jumps;
}

interface ScrubbingOptions {
  readonly track: HTMLElement;
  readonly durationSeconds: number;
  readonly actions: ShowActions;
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
}

/**
 * A drag pauses the show for its duration. Seeking a playing show would make
 * the narration player re-seek and restart its element on every step; against
 * a paused one the playhead simply moves, which is what scrubbing should feel
 * like. The prior transport state is restored when the drag ends.
 */
function attachScrubbing({
  track,
  durationSeconds,
  actions,
  onScrubChange,
}: ScrubbingOptions): void {
  let wasPlaying = false;
  let lastSentMilliseconds = 0;

  function readShowTime(event: PointerEvent): number {
    const bounds = track.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left) / bounds.width;

    return Math.min(Math.max(fraction, 0), 1) * durationSeconds;
  }

  track.addEventListener("pointerdown", (event) => {
    track.setPointerCapture(event.pointerId);
    wasPlaying = track.dataset.playing === "true";
    if (wasPlaying) actions.pause();

    const showTimeSeconds = readShowTime(event);
    lastSentMilliseconds = performance.now();
    onScrubChange(showTimeSeconds);
    actions.seekTo(showTimeSeconds);
  });

  track.addEventListener("pointermove", (event) => {
    if (!track.hasPointerCapture(event.pointerId)) return;

    const showTimeSeconds = readShowTime(event);
    onScrubChange(showTimeSeconds);

    const now = performance.now();
    const intervalMilliseconds =
      MILLISECONDS_PER_SECOND / CONDUCTOR_SETTINGS.scrubHertz;
    if (now - lastSentMilliseconds < intervalMilliseconds) return;

    lastSentMilliseconds = now;
    actions.seekTo(showTimeSeconds);
  });

  function endScrub(event: PointerEvent): void {
    if (!track.hasPointerCapture(event.pointerId)) return;

    track.releasePointerCapture(event.pointerId);
    // The throttle can have swallowed the last move, so land it exactly.
    actions.seekTo(readShowTime(event));
    if (wasPlaying) actions.play();
    wasPlaying = false;
    onScrubChange(undefined);
  }

  track.addEventListener("pointerup", endScrub);
  track.addEventListener("pointercancel", endScrub);
}

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
