<!--
Purpose: Document ownership of the experience audio layer.
Context: Narration is the first audio to ship; beds and the synth follow.
Responsibility: Explain what belongs in src/sound.
Boundary: When something plays is decided in src/dramaturgy, not here.
-->

# Sound

This folder owns **how the piece is heard**: the audio context, the media
elements, and their full lifecycle. It never decides *when* anything plays.

`audio-timebase.ts` owns the one `AudioContext`. Its `currentTime` is the
monotonic clock the Show Clock derives show time from — a hardware timebase
rather than accumulated frame deltas, so a long frame or a paused XR session
cannot drift the show away from the narration. A browser keeps the context
suspended until a user gesture, so the timebase attaches a self-removing
gesture listener; while it is suspended the timebase stalls, which correctly
freezes show time instead of letting the show run without its audio.

`narration-player.ts` follows the clock. It holds one preloaded
`HTMLAudioElement` per cue for the session's language only — about 7.4 MB
across eight recordings — because a retargeted single element would re-stall on
every seek across a cue boundary, and scrubbing is the reason the clock exists.
Elements stream; nothing is decoded to PCM. It mirrors the clock's time scale
onto playback rate, corrects position only past a tolerance because a re-seek
is audible, and falls silent where a slot outlasts its recording in the shorter
language.

The audio hardware clock is the **timebase**; the Show Clock in
`src/dramaturgy` is the **authority**. Everything here is a follower, so seek
and pause behave in rehearsal.

## Deliberately Absent

Per-sense audio beds, the drone-organ synth, spatial audio, and operator volume
are absent. A small issue-backed audio addition must follow the existing show
time, own a bounded voice/resource pool, and be measured on the PICO. Do not add
a second timeline or speculative audio framework.
