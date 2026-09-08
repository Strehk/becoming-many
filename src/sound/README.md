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

`SpatialAudio.createSource` bridges a caller-owned native node through
Three.js PositionalAudio with HRTF panning. Coordinates and distance parameters
are metres. A maximum of four placements is enforced; unloading a placement
disconnects its route and gain without stopping or disposing the caller's node.
Connected nodes use the same Tone-created native context. The positional route
has one destination path; its Tone source must not also call toDestination.

`training-audio.runtime.ts` consumes borrowed goal/formation/wake observations without
learning rules or a clock. One decoded sample is shared by one granular goal
voice and one quiet ordinary sample bed. Recipes bound grain size to 80–500 ms,
overlap to at most one grain, and playback rate to 0.25–2. This caps the default
100 ms lookahead at three future grain starts and 25 grains per second. Tone
14 also retains native sources through its stop timeout and lookahead tail;
those sources are included in the measured active-source budget.
Pause/complete stops source clocks; unload disposes both players and their
exclusive buffer references and disconnects the positional route. Fetch uses
Run's cancellation signal and late decode/import results cannot publish nodes.
The ambient player alone has a non-positional destination route.

`narration-player.ts` remains the single media playback implementation. It
accepts the recordings selected by Show, with measured durations. Main clips
preload during integrated training; changing the prepared set retains unchanged
cue/URL elements and releases tutorial-exclusive clips at handoff. Standalone
Start prepares only its own recordings. Show supplies the selected cue and offset, including pause
and language-repeat behavior. Reaching a recording's end leaves silence while
a spatial goal remains; audio completion never completes a learning task.

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

The [#112 integration step](../../docs/roadmap.md#granular-atmosphere--112)
extends `training-audio.runtime.ts` in place: replace the ordinary sample bed
with bounded granular layers, keep the separate spatial goal cue, and own one
shared atmosphere reverb within that same lifetime. `spatial-audio.runtime.ts`
continues to own placement/context/listener; Show continues to own transport and
speech. The drone organ is not replaced or used as a hidden resource owner.
This asset/plan update does not yet enable layers, reverb or production playback.


## Located tutorial narration candidates

The earlier issue's repository link resolves to
[E-Mus/becoming-many-tutorial, revision 52fdfdb69a80b63988b71e035614db8abad4bac1](https://github.com/E-Mus/becoming-many-tutorial/tree/52fdfdb69a80b63988b71e035614db8abad4bac1/public/audio).
Only the original audio bytes were inspected; no legacy runtime is reused.
The five German files are stereo, 48 kHz, float32 PCM. The source contains no
English recordings, effect samples, license or speaker attribution. These are
located candidates, not approved production assets; the literal Start recipe
therefore has no narration or sample references yet.

| Original file | Duration (s) | SHA-256 |
| --- | ---: | --- |
| `anfangundrechts.wav` | 20.725729 | `545adc1da2ee42ede8270483ac02281c879778fc750debf9ffece1711b0f244b` |
| `links.wav` | 2.735417 | `3964679d4963dc861787ab5024933b1a98dd44d512baad36578609e184ce46a0` |
| `oben.wav` | 4.334896 | `79a1ba5a1000fead1ce0abdea88c8da37f61536baff9cba60a3cc3becfb55d6d` |
| `unten.wav` | 2.552583 | `fe05c34a5668602e31a21960de10408e1f6d4df3f37c77b0341b3ec267f49cc9` |
| `ende.wav` | 13.861479 | `874e2854758de0907851de78c9fd3af09ead32e749da2b143795398ad3fbd5c7` |

The first recording reaches its right-lean instruction near 19 seconds. Final
content integration must align that orientation period with the unchanged
continuous M5 glide; preventing speech truncation alone does not establish
first-visitor pacing. DE-use permission and an explicit EN policy remain required content decisions.
Instrumental source material is now user-supplied above; excerpt selection,
granular mix and speech intelligibility still need actual listening. Script sources are unchanged.
