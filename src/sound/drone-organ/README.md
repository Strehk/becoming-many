<!--
Purpose: Explain what the drone organ is and where its pieces live.
Context: The instrument was ported here from its own repository, without the
  patch-cable interface it was played through.
Responsibility: Name the ownership boundaries inside the folder and the
  decisions the port made.
Boundary: The composed values live in drone-organ-settings.ts; which voice
  sounds when, and to what pulse, is the score in src/dramaturgy.
-->

# Drone Organ

The drone organ is the piece's generative instrument: nine layers, each one a
voice with its own level, room, and colour, each brought in by the dramaturgy's
score as the show climbs its ladder. It plays nothing that was written down —
the melodic voices walk a shared scale, so any combination of layers agrees
harmonically. What the show composes is which voices are heard, when, and how
loud; that lives in `src/dramaturgy/organ-score.ts`, not here.

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
  `organ-layer.ts` owns one voice's mix strip, strength fader, lane, and
  placement.
- `organ-timeline.ts` and `step-sequencer.ts` carry show time onto the
  rhythmic voices: each voice registers a grid of show seconds on its layer's
  lane, and every frame the steps just ahead of the playhead are placed onto
  audio time. There is no transport. `organ-random.ts` is the hash every
  generative draw comes from.
- `organ-signals.ts`, `signal-modulation.ts`, `nearest-anchor.ts`, the
  timeline, the sequencer, and `voices/derived-sequences.ts` are pure and
  covered by `tests/sound/`.
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
- **The show clock is the only clock.** The instrument ran on Tone's
  transport, a second timeline that a seek could not reach. It is gone: a
  step's time is its index times its length in show seconds, and the organ
  places the steps just ahead of the playhead onto Tone's audio time each
  frame. Pause holds the grids where they are; seek and rehearsal speed reach
  every voice. Wind and drones keep breathing through a hold, because they
  are not stepped at all.
- **Every note is a function of show time.** Nothing draws from `Math.random`.
  Density rolls, gusts, the bass loop's mutations, and the wind's walk are all
  hashed from the step, and the cumulative figures replay themselves from step
  zero after a seek backward. A seek therefore lands on the note playing
  through would have reached, the same promise the senses make.
- **A voice fades on the score's ramp, not a threshold.** The score derives a
  strength per voice the way the dramaturgy derives a sense intensity, and the
  layer's fader follows it. At zero the layer's lane sleeps, so a voice nobody
  hears schedules nothing; its continuous sources and rooms still run.
- **Placement is cheap on purpose.** A placed layer follows the nearest
  *cloud* — a flock, a swarm — never an individual bird, and a closed layer is
  not placed at all.
