<!--
Purpose: Explain what is verified about the conductor page.
Context: The page is DOM-bound, but the decisions behind it are not.
Responsibility: Route conductor tests and say what they deliberately leave out.
Boundary: The implementation lives in ../../src/conductor.
-->

# Conductor tests

The page itself is imperative DOM and is not tested here. Everything it decides
before touching the DOM is:

`conductor-keys.test.ts` covers the key map, including the presses the page
must leave alone: browser shortcuts and anything typed into a field.
`show-actions.test.ts` covers the operator's command surface over the show it
hosts — above all that the composite resets fire in the right order: restart
is rewind, flight reset, then play; reset is rewind, then hold.
`stream-button.test.ts` covers the whole availability × session matrix behind
the headset button's one label. `time-format.test.ts` covers the readouts an
operator scans mid-show, chapter names included.

Slot and headroom arithmetic is not here either — it belongs to the schedule it
measures, and is verified in `tests/dramaturgy/schedule-layout.test.ts`.
