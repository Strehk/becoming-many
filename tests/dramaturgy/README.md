<!--
Purpose: Explain what the dramaturgy tests cover.
Context: Show time and cue lookup are pure, so they are fully testable.
Responsibility: Route dramaturgy verification to its three suites.
Boundary: Audio playback is DOM-bound and is verified in the browser.
-->

# Dramaturgy Tests

`show-clock.test.ts` drives the clock through a fake timebase, which is why the
clock takes one as a parameter. It covers the invariants rehearsal depends on:
a paused clock holds, resuming continues rather than restarting, seeks clamp to
the show, relative scrubbing works in both directions, changing the rate does
not move the playhead, and a stalled timebase freezes show time.

`narration-schedule.test.ts` covers slot boundaries — silence before the first
cue and after the show length, a boundary instant belonging to the cue that
starts there, and the last cue holding to the end.

`piece-schedule.test.ts` locks the authored timing against the recordings it
plays: cues run strictly forward, every recording is used exactly once, and
**every slot is long enough for the longer of the two languages**. That last
one is the invariant that keeps German narration from overrunning cue times
shared with English.

There is no `tests/sound/`. The narration player is DOM-bound, and tests here
stay pure, so its decision logic was kept in `src/dramaturgy` where it can be
covered.
