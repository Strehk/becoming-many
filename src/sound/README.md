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

## Not here yet

Per-sense audio beds faded by each sense's intensity signal, the drone-organ
synth as a sound engine without its UI, spatial audio, and operator volume are
all planned and deliberately absent. The `AudioContext` is the connection point
they will share; a master gain node arrives with the first of them, measured on
the PICO rather than assumed.
