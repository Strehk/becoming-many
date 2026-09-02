# MVP Roadmap

The roadmap starts from the [current working system](current-status.md). Each
milestone should produce one measurable result before broader infrastructure is
added. Section numbers group implementation areas; the current feature track is
the landscape-module sequence in section 5.

## Completed Foundation

- strict TypeScript, Vite, Three.js, and one render loop
- user-triggered `immersive-vr` entry
- pointer-lock desktop movement
- sparse White World level preset
- synchronous module lifecycle
- aligned fixed-capacity chunk windows
- bounded cooperative stream queue
- one-draw deterministic Air Particles consumer with GPU animation
- deterministic World Surface with separate height and zone queries
- fixed-capacity generated Terrain consumer
- fixed-capacity one-draw Grass consumer with GPU wind
- composable single-pass Magnetic Sense stripe effect
- explicit GLTF preloading and complete multi-part model extraction
- compact zone-driven Vegetation and Rocks streaming
- bounded four-species Animals MVP
- top-level Bun tests for world infrastructure and module integration

This foundation is code-complete for its current scope. It is not yet approved
for physical PICO performance.

## 1. Navigation Boundary — Planned

- normalize desktop input before applying movement
- expose position, orientation, and velocity as the navigation state
- pass navigation state explicitly into world updates
- add listener and pointer-lock cleanup
- keep terrain, collision, streaming, and XR view logic outside navigation

## 2. Performance Harness

- deterministic benchmark flight route
- frame-time median, p95, and p99
- `renderer.info` counts
- queue depth and streaming duration
- browser baseline
- first physical PICO run at 90 Hz, with 72 Hz retained as a candidate fallback

## 3. Terrain Measurement

- measure the implemented recycled chunk terrain on desktop and PICO
- record streaming spikes, draw calls, triangles, and long-flight memory
- compare a GPU clipmap only if measurements show the chunk candidate is not viable

## 4. Generated Landscape Foundation — Implemented MVP

- deterministic ground and visible-surface sampling from absolute coordinates
- one continuous carved river represented through the water zone
- generated-chunk consumer using `ChunkWindow` and `StreamQueue`
- fixed mesh and staging-buffer capacity
- stable memory over a long flight remains to be measured
- floating origin only when world-coordinate range requires it

## 5. World Fields and Landscape Modules — In Progress

Follow the boundaries in
[Landscape Module Contracts](landscape-modules.md), one measurable module at a
time:

1. high-capacity instanced grass — implemented MVP, browser measurement recorded, PICO pending
2. instanced trees and bushes — implemented MVP, browser measurement recorded, PICO pending
3. instanced rocks — implemented MVP, browser measurement recorded, PICO pending
4. visible rivers consuming the existing surface facts — next

Each module owns its placement and resources, retains fixed capacity, hides
chunk boundaries, unloads cleanly, and passes target-device measurement before
the next module starts. Do not add a generic ecology or placement framework in
advance.

## 6. Animals — Implemented MVP

- manifest runtime paths align with `public/animals`
- authored actor counts per species consume World Surface without sibling imports
- simple bounded movement and deterministic habitat search are active
- only the nearest configured actors render and animate
- spatial audio and complex behavior remain deferred

## 7. Narrative Runtime

- Test Level
- audio master clock *(built: one virtual show clock on the audio timebase)*
- operator transport and restart *(built: the conductor page hosts the show,
  scrubs the schedule, restarts the experience, and resets the clock, the
  flight, and itself)*
- typed state transitions
- module preloading and unloading around timeline cues
- per-sense intensity envelopes on the schedule

## 8. Perception Modules

Develop and measure scent, depth, motion, and thermal perception independently.
Magnetic Sense has an implemented terrain-line MVP and a browser diagnostic
measurement; physical PICO measurement remains open. Reuse existing landscape
geometry and fixed pools.

## 9. Connections

- bounded local mycelium and root networks
- relationships derived from streamed world positions
- controlled integration of earlier perception languages

## 10. Platform Integration

- passthrough onboarding and offboarding
- standalone PICO presentation profile
- Windows PCVR research and wired profile
- operator controls with confirmed headset state
- ICAROS input adapter

## 11. Full Integration

- complete continuous narrative timeline
- long-flight memory stability
- no shader, loading, upload, or disposal spikes
- standalone and PCVR acceptance runs

## Completion Gate

```text
brainstorm → implement MVP → test and type-check → measure
→ remove bloat → measure again → checkpoint
```
