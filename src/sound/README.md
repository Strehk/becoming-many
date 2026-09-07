# Sound

## Responsibility

Audio follows Show time and owns the resources that make the piece audible.
Show and its typed schedule/score decide what plays when. Operator controls and
CSS belong to UI; an AudioContext's browser user-activation listener belongs
to its audio resource owner.

## Public interface

`audio-timebase.ts` owns the native AudioContext whose `currentTime` supplies
ShowClock's timebase. Suspension stops Show time. `narration-player.ts` follows
the selected cue/time/rate using preloaded HTMLAudioElements for one language.
`drone-organ/` follows Show frames and spatial signals through its own contract.
Tone is loaded lazily; its organ uses a separate Tone-owned AudioContext.
The two contexts do not create two Show clocks; Tone Transport is not used.

## Resources and boundaries

Show owns narration/organ followers. Each audio owner releases its media/nodes,
user-activation listeners and context, including pending imports and late
creation on cancellation. The existing lazy boundary remains useful; do not
replace it with a generic audio manager or move sound into the Station backend.

Per-sense beds, operator volume and a shared master gain remain unimplemented.
Changes to content or output follow their own scoped decisions. Existing desktop
measurements do not prove stable 90 Hz on the actual Windows-PCVR USB-C
installation. See [Performance](../../docs/performance.md),
[Architecture](../../docs/architecture.md) and the organ's own README.
