# World

This folder contains the permanent World Engine infrastructure. It owns the
single render loop, WebXR integration, logical world coordinates, module
lifecycle, the shared chunk grid, and the bounded scheduling used by streamed
content.

Unloadable experience content belongs in `../modules`. Input and navigation
belong in `../control`. The World Engine coordinates those systems without
knowing whether a chunk contains particles, terrain, vegetation, or animals.
The deterministic physical surface belongs in `../world-surface`; it has no runtime
lifecycle and does not enter the World Engine.

`wind.ts` is the single source for the global wind: its mean direction,
strength, and speed, plus how far the direction swings and how deeply the
strength gusts. `getWorldWind(seconds)` samples the wind blowing at one
moment. It is a pure function of time, so the world keeps no wind state and
every consumer sampling the same second gets the same wind; consumers advance
their own clock and wrap it with `wrapWindSeconds`, where the sample repeats
exactly. Every wind-reactive component reads this file instead of defining
component-local wind values.

Grass still samples the mean direction once when its material is created, so
it does not yet follow the turn. That is a gap rather than a second wind: no
narrative level renders grass at present, and wiring its uniform to the turn
is a change to the Grass module that should be measured with it.

## Runtime responsibilities

`world-settings.ts` keeps the permanent renderer and stream-queue tuning values
in one editable place. `world-runtime.ts` consumes those settings while creating
the Three.js scene, camera, renderer, module runtime, and stream queue.

The renderer settings are the attributes of the one WebGL2 context, which
`world-runtime.ts` creates itself and passes to `WebGLRenderer` alongside its
canvas. They include `xrCompatible: true`: a context that is XR-compatible from
creation spares Three.js the `makeXRCompatible()` call it would otherwise make
while adopting a session the headset already presents, and therefore spares the
world the context loss a runtime on another adapter answers with. A lost
context is reported on the console, because the silent rebuild that follows the
restore otherwise looks like a page reload.

Every frame follows one order:

```text
update navigation
→ let active modules request work
→ process a bounded amount of streaming work
→ render once
```

`module-runtime.ts` controls complete module lifecycles:

```text
load → activate → update → deactivate → unload
```

This is intentionally separate from chunk streaming. Loading a module creates
its fixed CPU and GPU resource pools. Streaming only recycles those resources
while the loaded module follows the player.

## One aligned chunk grid

`chunk-system.ts` provides the shared sizes and flat surface window;
`volume-chunk-window.ts` extends the same grid through Y. The base chunk is 16
metres wide. Larger levels double that size:

```text
level 0:  16 m
level 1:  32 m
level 2:  64 m
level 3: 128 m
```

Because every size is a power-of-two multiple of 16 metres, flat surface chunks
and volumetric chunks still meet on shared world-grid lines. The grid never
depends on travel direction or loading order.

## What a chunk window means

The conceptual world is infinite, but the device can hold only finite
resources. `ChunkWindow` keeps a finite X/Z square for surface content.
`VolumeChunkWindow` applies the same slot-recycling logic to an X/Y/Z cube for
content such as Air Particles.

Its radius is configurable:

```text
chunks per side = radius × 2 + 1
surface slots   = chunks per side²
volume slots    = chunks per side³
```

A radius of 1 produces 3×3 surface chunks with 9 slots or 3×3×3 volume chunks
with 27 slots. The radius must cover the visible distance plus enough
preparation space for the module's streaming work.

The slot count remains fixed after creation. Crossing a chunk boundary does
not grow the world or recreate the pool. Modulo arithmetic maps only the new
edge or square face onto slots that left the opposite side.

## Assignments and revisions

Both window types return only changed assignments. Each assignment tells a
module:

- which fixed resource slot to reuse
- which absolute chunk coordinates it now represents
- where that chunk begins in world space
- which revision currently owns the slot

The revision protects delayed work. If generation takes several frames and
the slot is reassigned before it finishes, the window's `isCurrent()` returns
false. The obsolete result is discarded instead of overwriting newer content.

The chunk window still creates no Three.js objects and generates no content.
It only describes where fixed module resources belong.

## Repeated and generated content

Every module consumes the same assignments but chooses one of two simple uses:

1. **Repeat:** Build local content once and place it at every assigned origin.
   No implemented module currently needs this mode.
2. **Generate:** Derive content deterministically from the world seed,
   absolute world coordinates, and write it into the assigned slot. Terrain
   samples World Surface ground heights; Air Particles hash X/Y/Z coordinates.

Keeping this decision inside each module prevents particle or terrain branches
from entering the shared chunk system.

## Bounded stream queue

`stream-queue.ts` spreads procedural work across frames. Modules submit small,
cooperative jobs. The queue advances each pending job at most once per frame
and stops starting work when the shared deadline is reached.

Jobs use a stable resource-slot key. Newer work for the same key replaces the
older pending job. Every job also exposes `isCurrent()`, allowing recycled or
unloaded module work to disappear before it mutates resources.

One small dependency priority keeps recycled support coherent: pending Terrain
rows finish before ordinary content jobs advance. Vegetation and Rocks can
therefore never publish an incoming chunk before its ground exists.

The queue can stop before starting another step, but JavaScript cannot be
interrupted while a step is already running. A module must therefore divide
generation into genuinely small operations rather than submit one complete
landscape chunk as a single step.

The MVP deliberately has no worker pool, general asset-streaming framework,
runtime quality adaptation, or distance-based priority system. Those additions
need measured PICO evidence.
