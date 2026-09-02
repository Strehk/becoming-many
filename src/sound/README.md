<!--
Purpose: Document ownership of the experience audio layer.
Context: Narration and the drone organ ship; per-sense beds follow.
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

`drone-organ/` is the piece's generative instrument: nine layers, each opened
by one of the show's senses, built on Tone.js and driven from the level
runtime. It loads Tone only when a show actually asks for the organ, and it
plays on the context Tone builds for itself rather than on the timebase's —
Tone's `AudioWorklet` nodes only come up on a context its own audio library
created, and sharing this one measurably silenced every voice's room. The two
contexts never mix audio: the timebase's carries no nodes at all, and both
resume on the same first gesture. The organ's own README explains the
composition and what the port from the instrument's old repository left behind.

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

Per-sense audio beds faded by each sense's intensity signal, and operator
volume, are planned and deliberately absent. The organ gates its layers on a
sense threshold rather than fading them with the intensity signal, which is the
next step toward that. No master gain across narration and organ exists yet
either; both reach the destination on their own, on their own contexts.

The organ's cost has been measured on nothing but a desktop browser so far. It
carries four Freeverb rooms and one convolution reverb, and Tone builds
Freeverb on `AudioWorklet` — that is the first thing to measure on the PICO.
