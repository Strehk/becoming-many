<!--
Purpose: Track the cold-start CPU spikes caused by first-time rendering at show level transitions.
Context: The show composes all modules at startup but keeps later sense layers hidden until their cue.
Responsibility: Record the evidence, root cause, smallest viable fix direction, and acceptance criteria.
Boundary: This issue does not add a general loading system or claim physical PCVR validation.
-->

# Eliminate Cold-Start CPU Spikes at Level Transitions

**Status:** Open
**Priority:** Performance blocker
**Affected area:** Level Runtime, World Runtime, Three.js resource preparation
**Found:** 2026-09-02

## Problem

The experience produces short CPU spikes when a sense level becomes visible for
the first time. The spikes coincide with large single-frame stalls and are most
severe at the Echo and Thermal transitions.

This is not level or asset loading in the usual sense. The show loads its assets,
creates every configured module, and generates the initial resident content
before the render loop begins. At a cue boundary, the Level Runtime only changes
module visibility. The following render is nevertheless expensive because it is
the first render that exposes the new objects to Three.js and WebGL.

Target behavior: a first-time level transition must not perform unbounded shader
compilation or GPU resource initialization on the critical frame path.

## Reproduction

The issue was reproduced through the real local station flow:

1. Start the experience with `bun run dev`.
2. Start the station broker with `bun run station`.
3. Open the show page and `/conductor.html`.
4. Use the conductor cue jumps and move five seconds into each cue so its new
   sense has non-zero intensity and its gated modules activate.
5. Record animation-frame intervals, Chrome performance metrics, JavaScript CPU
   samples, and WebGL program and buffer calls.

The diagnostic run used desktop Chromium against the Vite development server.
It confirms the cause but is not physical PCVR acceptance evidence.

## Measurements

| Transition | Longest frame | New WebGL programs | `bufferData` calls |
| --- | ---: | ---: | ---: |
| Scent | 99.9 ms | 2 | 10 |
| Echo | 250.0 ms | 5 | 236 |
| Motion | 66.6 ms | 2 | 9 |
| Thermal | 283.4 ms | 3 | 70 |
| Magnetic | 33.4 ms | 1 | 4 |
| Connections | 83.4 ms | 2 | 10 |
| Return to White World | 16.8 ms | 0 | 0 |

Chrome attributed nearly all measured transition work to script execution rather
than layout. Function-level sampling identified Three.js program creation and
the synchronous first-use `getProgramInfoLog` path as the dominant work. Normal
module updates remained small by comparison.

The decisive control test was a second activation of the already rendered Echo
level. It produced no program links, no `bufferData` calls, and no frame above
16.8 ms. This establishes first-use renderer initialization as the cause rather
than the steady-state cost of the level.

Absolute desktop timings vary with the browser, driver, instrumentation, and
shader cache. The first-versus-second activation difference is the relevant
causal evidence.

## Root Cause

The current sequence is:

1. `startLevel()` loads all GLTF assets required by the composed show preset.
2. `setupLevel()` creates and loads every configured module.
3. Module `load()` functions create and populate their CPU-side geometries,
   materials, instance pools, and initial chunks.
4. The opening show state deactivates later modules by setting their groups or
   render objects to `visible = false`.
5. A cue raises a sense intensity above zero, and `followSenses()` activates all
   modules gated by that sense.
6. The next `renderer.render()` encounters those render objects for the first
   time and performs their deferred WebGL preparation in one frame.

That deferred preparation includes:

- shader source construction, compilation, linking, and first-use validation;
- vertex, index, custom attribute, and instance-matrix buffer creation;
- texture initialization, including animated-animal skinning resources;
- renderer binding-state and program setup for the newly visible material
  variants.

Echo is especially expensive because one cue exposes Terrain, Vegetation, and
Rocks together. Thermal exposes the animated animal population and its skinned
material variants. Smaller modules follow the same pattern at their respective
cues.

Three.js provides `WebGLRenderer.compileAsync()` specifically to make a scene
renderable without an avoidable first-use shader compilation stall. The current
runtime does not call `compile()` or `compileAsync()`, and it does not perform a
controlled GPU upload warm-up.

## Non-Causes

- **Network or GLTF loading:** assets are loaded once before `startWorld()`
  completes setup, not at each cue.
- **Level reconstruction:** the show composes the union of its modules once and
  gates existing module instances during playback.
- **DOM or conductor rendering:** measured layout time was zero during the
  transition windows.
- **Steady-state module updates:** reactivating a warmed level is smooth.
- **The bounded Stream Queue:** it schedules procedural replacement work but
  does not own WebGL shader compilation or first-time buffer upload.

The synchronous initial chunk generation remains a separate startup cost. It is
not the recurring transition spike documented here.

## Affected Files

- `src/levels/level-runtime.ts`
- `src/world/world-runtime.ts`
- `tests/benchmark/benchmark-browser.ts`
- `tests/benchmark/run-benchmark.ts`
- `src/benchmark/README.md`
- `tests/benchmark/README.md`
- `docs/performance.md`

## Smallest YAGNI Fix Direction

Move renderer first-use work from cue frames into an explicit preparation stage
after module composition and before the show becomes ready.

### 1. Precompile every composed material

Call `await renderer.compileAsync(scene, camera)` after all show modules and
material effects have been created. This should prepare the exact shader
variants used by Terrain, static populations, particles, senses, and animated
actors while allowing `KHR_parallel_shader_compile` to work when available.

The call belongs at the composition/runtime boundary, not inside concrete
modules and not inside cue activation. The current synchronous `startWorld()`
setup may need one narrow asynchronous readiness seam so the animation loop and
show clock do not start before preparation finishes.

### 2. Warm only the remaining measured first-use resources

Shader compilation alone may not account for the hundreds of first-use buffer
uploads seen at Echo. Measure again after `compileAsync()`. Add a controlled
warm-up render only if the trace still attributes transition stalls to deferred
buffer or texture initialization.

A viable measured follow-up is an offscreen render target during startup:

- preserve the authored module visibility and sense intensities;
- temporarily expose the composed render objects to the warm-up render;
- temporarily disable frustum culling for the renderable objects being warmed,
  because the real camera alone does not cover off-frustum resident content;
- render the real material variants into a small offscreen target;
- restore every visibility and intensity value before presenting a frame;
- dispose the temporary render target immediately.

Do not assume that one offscreen render prepared every resource. Record which
program, buffer, or texture calls remain at each cue and remove the warm-up if
it does not improve those calls. Animated animals may require one preparation update so the bounded visible
actor set and skinning resources exist before the offscreen render. That update
must not advance show time or leave simulation state changed.

### 3. Measure before adding more infrastructure

Implement shader precompilation first and measure it. Add the offscreen upload
warm-up only for the remaining measured stall. Keep the preparation stage small;
do not introduce a generic asset-streaming system, worker framework, or new
module lifecycle unless the measurement proves it necessary.

## Approaches to Avoid

- Do not keep every later module rendering at zero intensity for the whole
  experience. It removes the cold transition by paying its GPU and draw-call
  cost continuously.
- Do not use the Stream Queue for shader compilation. JavaScript cannot split or
  interrupt the WebGL driver's compilation and upload calls.
- Do not disable Three.js shader error checks as the primary fix. It hides useful
  diagnostics and does not remove compilation or resource upload itself.
- Do not rely on a previously warmed browser or driver shader cache. The show
  must pass from a fresh WebGL context.
- Do not spread module activation across visible frames if that changes the
  authored transition. Move preparation earlier instead of smearing the hitch.

## Verification

Add a cold-transition benchmark that starts with a fresh WebGL context and
crosses every show cue in authored order. The existing static route benchmark
does not exercise first-time cue activation.

The fix is complete only when all of the following hold:

- no cue transition links a new shader program;
- no cue transition performs a burst of initial buffer or texture allocation;
- the first activation and later activations have equivalent frame behavior;
- startup preparation produces no visible flash and does not advance show time,
  narration, controls, or simulation;
- desktop production-build tracing shows no long transition task attributable
  to renderer initialization;
- the physical Windows-to-PICO PCVR path sustains the 90 FPS target through
  every transition, with no frame exceeding the 11.11 ms budget because of
  cold renderer work;
- `bun test`, `bun run check`, `bun run lint`, `bun run build`, and Fallow pass.

Record the before-and-after cold-transition measurements alongside the physical
PCVR result, including the Windows PC, USB-C connection, SteamVR, streaming
client, and PICO versions. A warm desktop rerun alone is not acceptance evidence.
