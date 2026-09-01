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

`schedule-layout.ts` measures a schedule in seconds: where each cue's slot
starts and ends, how long its recording runs in a given language, and the
headroom between the two. It is the one place slot arithmetic lives, so the
guarantee the tests enforce and the timeline the conductor draws are the same
calculation.

`piece-schedule.ts` is the authored data for the main show. It opens on five
seconds of silence before the first word, so the visitor is flying before a
voice arrives. That lead-in needs no mechanism — `narrationCueAt` answers
nothing before the first cue, so it is simply the gap in front of `prologue`. A tutorial schedule
will sit beside it. Schedules are typed TypeScript data files, never JSON, per
the repository's configuration rule, and there is **one schedule authority
total**.

The clock reads the audio hardware timebase and the narration reads the clock.
That direction is the whole design: the audio clock is the *timebase*, the show
clock is the *authority*, and playback is a follower. Seeking to 03:12 lands
the narration 03:12 into the show, inside whichever recording covers that
instant — it never retriggers a file.

`level-runtime.ts` composes the two halves; this folder never imports
`src/sound`, and `src/sound` never decides when a cue plays.

## Not here yet

Per-sense intensity envelopes, the session state machine, per-sense audio beds,
and module preloading around cues are planned and deliberately absent. The
schedule contract grows to carry envelopes as a sibling field.

The conductor page (`src/conductor`) reads this folder to draw and scrub the
schedule. It is a consumer, never an author: cue times change by editing the
typed data file here, and there is still one schedule authority total.
