# Sound

Show selects narration and organ playback; Run owns complete audio lifetime.
The native `audio-timebase.ts` context remains separate: its currentTime drives
ShowClock and suspension freezes Show time. It is never connected to Tone.

`spatial-audio.runtime.ts` lazily acquires the existing Tone context for one Run. Run
ends its sound followers before awaiting this owner's context close/disposal.
Gesture wake remains available until unload, including after a later suspension.
A replacement Run creates a context only after the previous context has closed;
no source creates or replaces a live global context.

The shared Three.js AudioListener is the context's only pose writer. Run calls
its update after locomotion; it refreshes camera ancestors and uses the latest
available XR head position, orientation and roll, as the existing organ did. The listener is kept outside the rendered scene graph so
scene traversal cannot write it again. Stationary poses write nothing; moving
poses retain the existing organ's three-frame write interval. Organ signal
sampling remains separate from listener mutation. Native pose ramps are fixed
to 1/30 second: using Three's internal listener Timer with skipped idle writes
would otherwise make the first movement ramp over the entire stationary period.

Live gain/filter, source and listener parameters retire their previous automation
history before each changed write, holding the rendered value first. Tone 14's
bundled automation list otherwise retains past-only events and scans growing
histories. `audio-parameter.ts` applies this only to exclusively owned,
unmodulated live followers; it never cancels scheduled music controls. Existing
80 ms target smoothing, listener ramp timing and Three placement remain in place.

`narration-player.ts` owns clock-following main Show speech. It
accepts the main recordings selected by Show, with measured durations. Changing
language retains unchanged cue/URL elements and keeps the audible clip until its
silent replacement is ready. At most one outgoing clip survives the prepared set;
failed replacement does not stop current speech. Show
supplies the selected cue and offset, including pause and language-repeat behavior.
Unchanged Hold frames write neither native time nor rate. The player remembers
only the last applied held seek and one pending/rejected native play attempt;
Show remains the sole clock. A rejected start waits for Pause → Play or a new
cue intent, rather than allocating another promise per frame. Pause, cue changes
and unload invalidate stale requests; metadata arrival still applies the exact
current scrub target.

`drone-organ/` remains the distinct generative musical system. It borrows the
shared Tone context, follows Show's score and places its two existing equal-power
voices. It no longer owns a second listener writer, gesture listener or context
close path. Tone Transport is not a second Show clock.

Source capacities and local tests do not prove speech intelligibility, HRTF
front/back localization, first-time visitor comprehension or stable 90 Hz on
the actual Windows-PCVR USB-C installation. See [Performance](../../docs/performance.md).


## Granular atmosphere source material

On 2026-09-08 the user supplied eleven generated instrumentals for granular
recomposition, with multiple spatial layers, substantial reverb and a distant
character. They are source material, not a requested full-track soundtrack.
The user further requires concrete object binding and an audible near/far
relationship: each spatial layer belongs to a visible object/particle body and
uses that owner's world position. Direct level, filtering and room balance must
change smoothly with listener distance, while a diffuse hall must not mask
localization or remain equally loud at every distance. Static emitters never
follow the player; moving/removed objects move/end their own sound.
Original bytes are preserved under `public/audio/granular/`, named
`atmosphere-source-01.mp3` through `atmosphere-source-11.mp3`. Numbering maps
exactly to the original download suffix, without invented timbre names.
[Provenance](../../public/audio/granular/provenance.json) records that mapping,
SHA-256, measured format/duration/levels and original generator metadata (Suno).
The unnumbered file in Downloads was not among the eleven supplied files.

All eleven are distinct, fully decodable 48 kHz stereo MP3 files: 41,061,238 bytes,
1,775.1485 seconds total. Integrated loudness spans -16.2 to -12.5 LUFS; the
highest reconstructed true peak is +0.1 dBFS. These are technical measurements,
not an audition or a content recommendation. Original files were not normalized,
trimmed or transcoded. Direct listening was unavailable in this session.

| Source | Duration | Integrated loudness |
| --- | ---: | ---: |
| [atmosphere-source-01.mp3](../../public/audio/granular/atmosphere-source-01.mp3) | 1:10 | -16.2 LUFS |
| [atmosphere-source-02.mp3](../../public/audio/granular/atmosphere-source-02.mp3) | 2:26 | -14.6 LUFS |
| [atmosphere-source-03.mp3](../../public/audio/granular/atmosphere-source-03.mp3) | 1:01 | -14.1 LUFS |
| [atmosphere-source-04.mp3](../../public/audio/granular/atmosphere-source-04.mp3) | 2:18 | -13.3 LUFS |
| [atmosphere-source-05.mp3](../../public/audio/granular/atmosphere-source-05.mp3) | 3:48 | -13.3 LUFS |
| [atmosphere-source-06.mp3](../../public/audio/granular/atmosphere-source-06.mp3) | 2:07 | -12.5 LUFS |
| [atmosphere-source-07.mp3](../../public/audio/granular/atmosphere-source-07.mp3) | 3:09 | -12.8 LUFS |
| [atmosphere-source-08.mp3](../../public/audio/granular/atmosphere-source-08.mp3) | 2:43 | -14.0 LUFS |
| [atmosphere-source-09.mp3](../../public/audio/granular/atmosphere-source-09.mp3) | 3:31 | -13.9 LUFS |
| [atmosphere-source-10.mp3](../../public/audio/granular/atmosphere-source-10.mp3) | 3:33 | -14.2 LUFS |
| [atmosphere-source-11.mp3](../../public/audio/granular/atmosphere-source-11.mp3) | 3:49 | -13.8 LUFS |

The original source files and prepared mono excerpts remain available as authored
assets. The current Start level uses no audio; these recordings have no active
runtime consumer. Selection and listening remain future content work.

## Standalone tutorial voice

`voice-player.ts` owns one active native audio element and at most one silent
replacement for Start. Level Composition
injects its public `VoicePlayback` capability; Run owns cleanup. Start selects
recordings and instruction offsets. Optional spoken-marker maps translate native
seconds onto the initial cue timeline without changing playback rate. Native playback reports timing and
natural completion. Failure never masquerades as completion. Autoplay denial
retries on a pointer/key gesture; stop/unload invalidate pending promises and
unload releases gesture listeners and the media source. There is no second clock.
Main Show narration retains its clock-following player and EN/DE recordings.
The tutorial ships separate German and English recordings. Language replacement
preserves the active source until loading, seeking and playback succeed; newer
selection, clip changes and cleanup discard obsolete replacements.
