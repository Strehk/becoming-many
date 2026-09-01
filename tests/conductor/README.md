<!--
Purpose: Explain what is verified about the conductor page.
Context: The page is DOM-bound, but the decisions behind it are not.
Responsibility: Route conductor tests and say what they deliberately leave out.
Boundary: The implementation lives in ../../src/conductor.
-->

# Conductor tests

The page itself is imperative DOM and is not tested here. Everything it decides
before touching the DOM is:

`playhead.test.ts` covers carrying the playhead between the statuses that anchor
it — holding when paused, advancing at the show's own rate, and clamping at both
ends of the piece. `conductor-keys.test.ts` covers the key map, including the
presses the page must leave alone: browser shortcuts and anything typed into a
field. `time-format.test.ts` covers the readouts an operator scans mid-show.

Slot and headroom arithmetic is not here either — it belongs to the schedule it
measures, and is verified in `tests/dramaturgy/schedule-layout.test.ts`.
