<!--
Purpose: Explain what the sound tests cover.
Context: Most of src/sound needs a browser; the organ's patch chain does not.
Responsibility: Route sound verification to its suites.
Boundary: Audio graphs and media elements are verified in the browser.
-->

# Sound Tests

These suites use deterministic media and context fixtures to exercise playback
and resource ownership, plus the pure decisions driving the drone organ. Real
decoding, native media events and audio output still require browser evidence.

`voice-player.test.ts` checks mapped cue time, gesture retries, pause/resume,
delayed and failed replacements, rapid/reverted selection, bounded slow seeks,
natural completion and stale results after stop/unload.
`narration-player.test.ts` checks Show-clock following, exact held seeks,
bounded playback attempts and replacement without interrupting the old source.
It includes unequal recording lengths and slow-seek convergence.

Start's [recording tests](../modules/start/start-recording.test.ts) protect
spoken-marker correspondence; its [procedural tests](../modules/start/start-procedural.test.ts)
protect progress, geometry and presentation during live changes. The
[browser language suite](../browser/README.md#live-language-regression) verifies
the same path with shipped recordings and deliberate network failures.

`drone-organ-composition.test.ts` locks the composed piece against the score it
plays under: exactly one layer exists for every voice the score names, and
every authored control stays inside the range the instrument's knobs turned
in. Which voice sounds when is the score's promise, tested with the dramaturgy
in `tests/dramaturgy/organ-score.test.ts`.

`step-sequencer.test.ts` and `organ-timeline.test.ts` cover how show time
reaches the rhythmic voices without a transport: each step fires once across
consecutive frames, a held show places nothing, a seek in either direction
starts fresh from the playhead, a regrid takes effect from the next uncovered
instant, a step's audio time is its show-time distance divided by the rate the
show runs at, and a sleeping lane schedules nothing until it wakes.

`derived-sequences.test.ts` covers the promise that every note is a function
of its step: the hash is stable and spread, the walk and the mutating loop
answer the same degree for a step however it is reached, and they stay inside
their spans.

`organ-modulation.test.ts` covers the patch chain: reading height and compass
from a pose, mapping a signal into a control range, and the inertia in between.
It includes the reason the compass signal exists at all — both sides of north
read the same, where a compass course would jump.

`nearest-anchor.test.ts` covers how a placed voice finds the cloud it sounds
from: an empty group leaves the scratch point untouched and reports it, the
nearest is picked in three dimensions from the listener, and a trailing value
that is not a whole point is ignored.

The organ lifetime probe also covers shared context gesture wake, cancellation,
late follower construction and awaited context close across repeated lifetimes.
Spatial listening and actual audio-thread cost still need browser/headset evidence.
