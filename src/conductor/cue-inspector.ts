/**
 * Purpose: Show the authored numbers behind whichever cue is selected.
 * Context: Retiming a cue by ear needs its slot, its take, and the room between.
 * Responsibility: Render one cue's schedule and catalogue values as text.
 * Boundary: This reads the schedule; it is never a place to edit one.
 */

import { NARRATION_CUES, narrationUrl } from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { cueSlots } from "../dramaturgy/schedule-layout";
import type { ConductorPanel } from "./conductor-state";
import {
  formatDurationSeconds,
  formatHeadroomSeconds,
  formatShowTime,
} from "./time-format";

export function createCueInspector(
  parent: HTMLElement,
  schedule: NarrationSchedule,
): ConductorPanel {
  const root = document.createElement("footer");
  root.className = "conductor__inspector";
  root.setAttribute("aria-label", "Selected cue");
  parent.append(root);

  return {
    update(state): void {
      if (!state.selectedCueId) {
        root.textContent = "Select a cue on the timeline to read its timing.";
        return;
      }

      const slot = cueSlots(schedule, state.snapshot.language).find(
        (candidate) => candidate.cueId === state.selectedCueId,
      );
      if (!slot) return;

      const { en, de } = NARRATION_CUES[slot.cueId].durationSeconds;
      root.replaceChildren(
        ...[
          ["cue", slot.cueId],
          ["starts", formatShowTime(slot.atSeconds)],
          ["slot", formatDurationSeconds(slot.slotSeconds)],
          ["en", formatDurationSeconds(en)],
          ["de", formatDurationSeconds(de)],
          ["headroom", formatHeadroomSeconds(slot.headroomSeconds)],
          ["file", narrationUrl(slot.cueId, state.snapshot.language)],
        ].map(([label, value]) => createField(label ?? "", value ?? "")),
      );
    },
  };
}

function createField(labelText: string, valueText: string): HTMLElement {
  const field = document.createElement("span");
  const label = document.createElement("span");
  label.textContent = `${labelText} `;

  const value = document.createElement("strong");
  value.textContent = valueText;

  field.append(label, value);
  return field;
}
