<!--
Purpose: Explain what the sound tests cover.
Context: Most of src/sound needs a browser; the organ's patch chain does not.
Responsibility: Route sound verification to its three suites.
Boundary: Audio graphs and media elements are verified in the browser.
-->

# Sound Tests

The audio graph itself cannot be built here — Tone.js, the `AudioContext`, and
the narration elements all need a browser — so these suites cover the parts of
the drone organ that decide *what* the graph is asked to do.

`drone-organ-composition.test.ts` locks the composed piece against the show it
plays under: every layer is gated on a sense the ladder actually has, exactly
one voice is never put away, every sense of the ladder is heard by something,
and every authored control stays inside the range the instrument's knobs turned
in. It is the test that catches a retuned composition drifting away from the
dramaturgy it was written for.

`organ-modulation.test.ts` covers the patch chain: reading height and compass
from a pose, mapping a signal into a control range, and the inertia in between.
It includes the reason the compass signal exists at all — both sides of north
read the same, where a compass course would jump.

`nearest-anchor.test.ts` covers how a placed voice finds the cloud it sounds
from: an empty group leaves the scratch point untouched and reports it, the
nearest is picked in three dimensions from the listener, and a trailing value
that is not a whole point is ignored.
