<!--
Purpose: Document ownership of the runtime dramaturgy layer.
Context: One virtual clock and one schedule authority drive the whole show.
Responsibility: Explain what belongs in src/dramaturgy.
Boundary: Audio playback lives in src/sound; composition lives in src/levels.
-->

# Dramaturgy

This folder owns **show time**: the one virtual clock the piece is timed
against, and the baked schedule data played against it. Nothing here touches a
browser API, so all of it is covered by `bun test`.

`show-clock.ts` is the transport — play, pause, absolute and relative seek, and
time scale. Show time is *derived* from an injected monotonic timebase on every
read, never accumulated per frame, so a long or dropped frame cannot make the
show drift away from the audio it drives. The clock starts paused at zero, and
a stalled timebase freezes show time by design.

`narration-schedule.ts` holds the schedule contract and the pure show-time
lookup. A cue holds the timeline until the next cue starts, so no cue carries a
duration: the same section runs up to nine seconds longer in German than in
English while cue times stay shared, and taking the slot from the neighbours
makes that mismatch harmless.

`narration-catalog.ts` names every recording, owns the DE/EN union and the
measured recording lengths, and builds the served URL. Cue *times* are shared
between languages; only the files switch.

`show-levels.ts` answers which world state and sense strengths hold at a show
time. Each cue carries the level it speaks over, exactly as it carries its
recording: the level holds until the next cue starts, and before the first cue
the show already stands in that cue's world. Sense intensities are *derived*,
not authored yet: each cue boundary sets a per-sense target of zero or one from
the level ladder, and the strength ramps there over one shared fade constant,
starting at the boundary. `senseStandingAt` answers the same ladder one step earlier: whether a sense's
content must already be *running* at a show time, and whether it may be seen
yet. A module that is put away builds nothing — its chunk window stops
following the viewer, its actors stop moving — so a layer switched on at its
cue would stream and re-home in pieces under a fade that is already climbing.
That is what reads as popping. One prewarm window before the cue, the layer is
therefore stood up hidden, and the fade then only has to raise content that is
already complete. A jump straight into a cue skips the warming, because there
is no show time before it in which to warm.
`levelTransitionAt` reports the crossing itself —
which world the show is fading from, into which, and how far — for values
that blend between levels rather than belonging to one sense, the background
color above all. All lookups are pure functions of show time, so a seek or
scrub lands inside a world state and mid-fade exactly where playing through
would have.

`schedule-layout.ts` measures a schedule in seconds: where each cue's slot
starts and ends, how long its recording runs in a given language, and the
headroom between the two. It is the one place slot arithmetic lives, so the
guarantee the tests enforce and the timeline the conductor draws are the same
calculation.

`piece-schedule.ts` is the authored data for the 8:41 main show. It opens on five
seconds of silence before the first word, so the visitor is flying before a
voice arrives. That lead-in needs no mechanism — `narrationCueAt` answers
nothing before the first cue, so it is simply the gap in front of `prologue`.
No tutorial schedule is currently implemented. Schedules are typed TypeScript data files, never JSON, per
the repository's configuration rule, and there is **one schedule authority
total**.

The clock reads the audio hardware timebase and the narration reads the clock.
That direction is the whole design: the audio clock is the *timebase*, the show
clock is the *authority*, and playback is a follower. Seeking to 03:12 lands
the narration 03:12 into the show, inside whichever recording covers that
instant — it never retriggers a file.

`end-credits.ts` is the piece's authored ending: the ordered closing lines and
the pure ramp that answers how present they are at a show time. The ramp is
derived the same way the sense strengths are — from one authored instant on the
schedule, `creditsAtSeconds` — so a seek lands mid-fade, a seek to zero puts the
panel away, and the clock clamping at the show length is what holds the credits
up until staff restart. What the panel looks like belongs to
`src/modules/end-credits`.

`level-runtime.ts` composes the two halves; this folder never imports
`src/sound`, and `src/sound` never decides when a cue plays.

## Deliberately Absent

Authored keyframed envelopes, an installation session state machine, and
per-sense audio beds are absent. The current derived ramp in `show-levels.ts`
is the complete implemented intensity signal. Add authored curves or a tutorial
only when a concrete product issue requires them.

The conductor page (`src/conductor`) reads this folder to draw and scrub the
schedule. It is a consumer, never an author: cue times change by editing the
typed data file here, and there is still one schedule authority total.
