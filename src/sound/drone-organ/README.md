<!--
Purpose: Explain what the drone organ is and where its pieces live.
Context: The instrument was ported here from its own repository, without the
  patch-cable interface it was played through.
Responsibility: Name the ownership boundaries inside the folder and the
  decisions the port made.
Boundary: The composed values live in drone-organ-settings.ts; when a sense
  rises is decided in src/dramaturgy.
-->

# Drone Organ

The drone organ is the piece's generative instrument: nine layers, each one a
voice with its own level, room, and colour, each opened by one of the show's
senses. It plays nothing that was written down — the melodic voices walk a
shared scale, so any combination of layers agrees harmonically. What the show
composes is which layers are heard, and how loud.

Two of the layers are placed in the world: a wing beat on the nearest bird
flock, another on the nearest insect swarm. Two more are patched to the flight
itself — the wind opens as the visitor climbs, and the magnetic drone turns
with the compass.

## Where things live

- `drone-organ.ts` is the entry. It carries the per-frame contract and loads
  the rest **dynamically**: importing Tone.js builds an `AudioContext` — the
  one the organ then plays on — and a benchmark run or a bare level page must
  not pay for one.
- `drone-organ-settings.ts` is the composition — the piece the organ plays,
  and the only file to retune it in.
- `organ-runtime.ts` builds the instrument and follows the world each frame.
  Everything Tone touches hangs below it.
- `organ-engine.ts` owns the master chain and the shared room;
  `organ-layer.ts` owns one voice's mix strip, gate, and placement.
- `organ-signals.ts`, `signal-modulation.ts`, and `nearest-anchor.ts` are pure
  and covered by `tests/sound/`.
- `voices/` holds one file per voice, plus the room, the walk, the chord
  cycle, and the looping sequence they build on.

## What the port left behind

The original instrument was a phone-sized rack with patch cables, a sense
sheet, drift LFOs, a master EQ, and a flight simulator to demonstrate itself
with. None of that is here. The composition is fixed, so only what it actually
reaches for was carried over:

- **Eight of the instrument's voices**, of the fifty-odd it offered.
- **Two of its world signals** — height and compass — of a whole console.
- **Master EQ, master filter, and master delay are gone.** The composition
  leaves all three neutral or silent, and an unused biquad still costs a
  headset frame budget it does not have.
- **Patch cables lost their strength and curve controls.** Every cable in the
  composition runs at full strength through a linear curve.

## Decisions worth knowing

- **The organ plays on Tone's own `AudioContext`, not the show's.** Tone
  reaches the hardware through standardized-audio-context, whose
  `AudioWorklet` nodes only come up on a context that library created. Sharing
  the timebase's context was measured on the built page: all thirty-two comb
  filters of the four voice rooms failed to build, one unhandled
  `InvalidStateError` each, and the rooms fell silent while the rest played on.
  The two contexts never mix audio — the timebase's carries no nodes, it is the
  show's clock — and both resume on the same first gesture.
- **A gate is a threshold, not a fade.** A layer opens once its sense passes
  half strength and closes again below it, which is what the composition
  authored. Fading each voice with its sense's intensity is the documented
  direction (`docs/direction/dramaturgy-audio.md`) and a deliberate next step,
  not something this port decided on its own.
- **A held show holds the beat, not the drones.** Pausing stops the transport,
  so the rhythmic voices stand still while wind and drones keep breathing.
- **Placement is cheap on purpose.** A placed layer follows the nearest
  *cloud* — a flock, a swarm — never an individual bird, and a closed layer is
  not placed at all.
