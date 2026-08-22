# Architecture

**Status: DRAFT v2 — core decisions confirmed in the design session of 2026-08-21; items
marked SPIKE still need validation on real hardware before they count as final.** Sources: a
full exploration of `../bm-base` (app + M5/bridge/firmware, including the firmware that
actually lives in `../Icaros_Host`), the five experiments in `../experiments`
(`pico-remote-control` findings integrated 2026-08-21, `magnetic-sense-webxr` 2026-08-22),
and the
Futurium deployment decisions recorded in §2.

---

## 1. Design principles

These are the answers to "solid, bullet-proof, works in any state, and optimized". Every
structural decision below follows from one of them.

1. **One loop, one clock, one work queue.** A single `renderer.setAnimationLoop` frame loop
   with explicit phases; a single virtual clock every animated thing reads; a single
   prioritized background-work queue that admits at most one expensive item per frame.
   bm-base ran four independent rAF chains plus ad-hoc timers — that is the bottleneck
   pattern we are eliminating.
2. **The void is the base state; everything else is an optional layer.** The app must boot,
   fly, and end cleanly with *zero* sense modules loaded (white void + wind). Every sense,
   every creature system, every audio layer registers into the runtime and can be absent,
   disabled, or crashed without taking the piece down. This is both the artistic rule
   ("senses layer, never swap") and the robustness rule.
3. **CPU sets up, GPU animates.** Setup work produces immutable typed arrays; per-frame cost
   is uniforms and bounded prefix uploads only. All four rendering experiments independently
   converged on this idiom — it becomes law. Corollary from `magnetic-sense-webxr`:
   procedural per-instance variation (jitter, rotation, size, wind phase, fades) is derived
   by hashing the **integer world cell**, never a buffer index or a floating position —
   camera-centred origin snaps then cannot reseed anything, which is what keeps
   re-origining flicker-free.
4. **One source of truth per concern.** One schedule authority, one uniform set, one animal
   substrate, one wire-protocol module, one height field feeding terrain + placement +
   networks. bm-base decayed by growing second copies of each of these.
5. **Capacities are runtime knobs, never compile-time constants.** Buffers are allocated
   once at a preset ceiling; visible counts are `drawRange`/instance-count knobs the perf
   governor can turn every frame. (Anti-example: bm-base's `BLADES_PER_AXIS = 768` baked
   589,824 grass blades into the dispatch size.)
6. **Strict gates from commit one.** The bm-base tsconfig discipline (`strict`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …, Biome banning `any`/`!`/`as`)
   demonstrably held across 36k lines. It is retrofit-proof, so it starts with the repo —
   as do Biome's formatter (machine formatting, not editor preference) and the rule that
   new pure logic lands with its tests in the same change. One command (`bun run check`,
   §12) is the gate humans and CI both run.

## 2. Deployment topology (decided)

**Two identical, fully independent stations** at the Futurium. Each station:

- **ICAROS flight rig** (as in the previous installation) with the **M5StickC Plus2**
  mounted on it (external start button on GPIO26).
- **Station PC** (Windows, VR-ready): renders everything. Chrome runs the experience as a
  **PC-VR WebXR session through SteamVR/OpenXR**; video+audio reach the headset via
  **PICO Business Streaming**.
- **PICO 4 Enterprise** headset — a display, not a compute platform. Its enterprise OS
  matters: it allows the headset agent (§10.3).
- **Operator page on a second monitor of the same PC.** Staff operate locally; no staff
  tablets, no remote operation.
- The two stations **share only the network**. Nothing else is shared; there is no central
  server. Station identity (which M5, which rig profile, which room) is local config.

Consequences that simplify everything:

- The experience page is served from **`http://localhost`** on the station PC — a secure
  context (WebXR works) with **no mixed-content blocking**, so plain `ws://` to LAN devices
  is allowed. The entire TLS/relay/BLE problem space from the old project disappears.
- The perf budget is a **desktop GPU**, not a mobile chipset. Standalone-headset budgets no
  longer bind (they return only if the on-headset fallback in §10.5 is ever exercised).
- The operator page's "live visitor view" is trivial: the visitor's frame is rendered on
  this very machine.

## 3. Rendering stack

- **three.js (latest), `three/webgpu` + TSL only.** TSL compiles to WGSL on WebGPU and to
  GLSL on the automatic WebGL2 backend fallback — one shader source, both worlds. bm-base
  was already TSL-only; the three experiments are raw GLSL/WebGL2 and their shaders get
  ported to TSL as part of extraction, not copied.
- **Forbidden:** raw `ShaderMaterial`, `onBeforeCompile` chunk injection, `.glsl` files.
  These have no future on the WebGPU path.
- **WebXR** via `renderer.xr` with a proper rig: the camera lives in a `Group` that
  locomotion moves (EZ-Tree-Demo's silent XR failure was mutating `camera.position` with no
  rig — locomotion no-ops in immersive mode).
- **SPIKE R1:** WebGPU-backed WebXR (`XRGPUBinding`) on desktop Chrome + SteamVR — verify
  it initializes and measure the WebGL2-fallback delta. The renderer choice is final either
  way (fallback is automatic); the spike sets expectations.
- **Carry over verbatim:** bm-base `src/render/camera-pos.ts` — the TSL `cameraPosition`
  node does not resolve under the WebXR+WebGPU path; every camera-relative effect reads a
  CPU-fed uniform. Expensive knowledge; do not rediscover. Likewise the small TSL kit
  (`viewReveal`, `distanceFog`, `fresnelEdge`, `depthBands`).
- **Undeformed-footprint rule** (from `magnetic-sense-webxr`): a sense that paints a
  pattern onto animated geometry samples its field at the *undeformed* world position,
  passed alongside the deformed vertex. Wind moves the rendered blade; the pattern stays
  nailed to the landscape instead of swimming with the animation. Standard idiom in the
  TSL kit for every field-on-geometry effect.
- **Run modes: PC-VR and desktop dev mode (keyboard flight) only.** The old mobile-gyro
  mode is dropped.

## 4. Repository layout

Single Vite app with multiple pages, firmware in-repo (its absence from bm-base was the
root cause of protocol drift), shared code in plain folders — no workspace machinery until
something actually needs it.

```
becoming-many/
  index.html            # the experience (station PC, localhost)
  operator.html         # staff page: session control, monitoring, live view (second monitor)
  setup.html            # M5 flashing + configuration page (operator/technician only)
  src/
    core/               # signals, bus, clock, schedule player, perf router — ZERO three.js imports, fully unit-tested
    render/             # renderer bootstrap, XR rig, frame loop + phases, TSL kit, compute-pass registry
    world/              # height field, chunk streaming, ecology lattice, wind field, terrain material
    senses/<id>/        # one folder per sense layer, each implementing the SenseLayer contract
    beings/             # the ONE animal/flora substrate: instanced actors + drivers (boids, routes, events)
    audio/              # clock-slaved director, drone-organ engine, per-sense layers, narration player (de/en)
    control/            # ControlFrame contract + pipeline + sources (keyboard, m5)
    session/            # session state machine (idle → boarding → tutorial → piece → return), operator protocol
    experience/         # start/tutorial content, credits, run modes
    ops/                # dev console, minimap, perf HUD — lazy-loaded, absent from audience build path
    operator/           # code for operator.html
    setup/              # code for setup.html (Web Serial config + esp-web-tools flashing)
  station/
    server/             # tiny localhost server: serves pages, brokers operator/session/agent messages, OpenVR telemetry
    tools/headsetctl/   # tethered technician CLI: ADB install/launch/reboot/screenshot + bounded scrcpy mirror (§10.4)
  firmware/
    m5-broadcast/       # PlatformIO project, ESP32 (M5StickC Plus2)
  headset-agent/        # Android app for the PICO 4 Enterprise (see §10.3)
  shared/
    protocol/           # single wire-schema module: M5 frames, session/operator messages, agent messages
  docs/
  script/               # narration (already present; de + en are both shippable content)
```

## 5. The runtime core (`src/core/`)

Ported nearly verbatim from bm-base — its one unambiguously good layer (~250 lines):

- **Signals** with `subscribe()` (event-rate) vs `peek()` (90 fps hot path), a named
  registry, and a documented **one-writer law** per cell.
- **Bus** with `emit`/`on`/`when(signal, predicate, handler)` evaluated once per frame.
  Direction stays asymmetric: **commands in over the bus, state out over signals.**
- **Clock**: virtual time with pause/seek/timeScale and seek-safe cues. Everything —
  visuals, schedule, audio, credits — advances through it, which is what makes scrubbing
  and rehearsal work.
- **Schedule player**: THE single dramaturgy authority (see §8).
- **Perf router**: one table mapping every quality knob to its destination, shared by the
  governor, the dev console, and presets.

### Frame loop contract

```
INPUT      controls → ControlFrame; XR pose read
SCHEDULE   clock advance → schedule envelopes → sense/audio signals; bus.tick() cue edges
SIMULATE   registered systems tick at their declared rates (90 Hz / 20 Hz / on-event)
PUBLISH    signals settle; one background-work item admitted (chunk build, tree gen, …)
RENDER     registered compute passes (skipped for inactive layers) → single render
```

Systems register `{ id, rate, tick(ctx) }` into the loop; nothing owns a private rAF or
`setInterval`. Dev UIs (console, minimap) piggyback on the same loop and sample only while
open.

## 6. The SenseLayer contract (`src/senses/`)

Each sense is a self-contained module:

```ts
interface SenseLayer {
  readonly id: SenseId;
  load(): Promise<void>;                 // assets, buffer allocation (ceiling-sized)
  init(ctx: WorldContext): void;         // attach to scene, register compute passes
  // intensity 0..1 is a UNIFORM — activation costs no recompile, no scene churn
  // (driven from the schedule via its signal; the module never reads the clock directly)
  params: ParamDescriptor[];             // UI-agnostic knobs → dev console renders them
  audio?: SenseAudioLayer;               // the sonic counterpart, faded by the same signal
  dispose(): void;
}
```

- Shader senses (colour, echo, infrared, UV) composite through the **SenseSystem
  compositor** ported from bm-base: layers over the white base, gated by uniforms, so the
  Overload phase (everything at once) is the same shader as the void.
- World-object senses (scent, network, motion, magnetic sky) own their objects but must
  respect the reveal rule: intensity 0 ⇒ invisible ⇒ their compute passes are skipped.
- A sense that fails to `load()` is logged, skipped, and the schedule simply has no effect
  on its signal. The piece still runs.

### Extraction map (experiments → senses/world)

| From | What | Into |
|---|---|---|
| `scent-particles` | route-atlas single-drawcall particle system (200k, moving emitters, trails sample `uTime - flightAge`) | `senses/scent` — port to TSL; fix `depthTest:false` hack for stereo |
| `wurzeln` | traffic-reinforced network topology (MST + kNN + BFS transport) and one-drawcall instanced-tube growth shader | `senses/network` — topology moves into a worker (it is O(n²) and main-thread today) |
| `EZ-Tree-Demo` | chunk pool + prefix-upload instancing + wind uniform contract + population lattice + ecology zones + worker tree-LOD generation + frame histogram + Playwright perf gates | `src/world/`, `src/beings/`, perf harness |
| bm-base | scent field (movable local anchor), magnetfeld sky (9 modes by weight uniforms), motion trail ring buffer, WFC root web with hash-agreed borders, grass TSL | respective senses — these are already TSL |
| `magnetic-sense-webxr` | geometry-clipmap terrain with vertex-shader height; additive-density instanced grass with view-directed coverage and integer-cell hashing; magnetic field contract coloring terrain + grass through one uniform set | `src/world/` (terrain surface, ground cover) — port to TSL; field visuals into `senses/magnetic` (ground counterpart to the bm-base sky) |

## 7. World and beings

- **One height field** (domain-warped fBm from EZ-Tree-Demo) is the single source for
  terrain mesh, placement lattice, water, and underground networks.
- **Terrain surface: geometry clipmap, not chunks** (proven in `magnetic-sense-webxr`).
  Eight permanently reused concentric ring meshes, re-centred only on the coarsest grid
  spacing so overlapping LOD samples keep identical world positions (no "breathing"
  relief), height evaluated entirely in the vertex shader. Roughly 24 km of terrain in
  eight draw calls with **zero runtime geometry builds or uploads** — the "terrain chunk
  build" work-item class disappears from the frame loop. Hazard to manage: the height
  field now exists twice — TSL for the GPU surface, a TS mirror for placement, water,
  and flight — and one mismatch means floating objects. Both implementations derive from
  one shared constants module, and a CI readback test asserts CPU/GPU height agreement
  (§12).
- **Chunk streaming (populations only)** merges the two proven implementations: bm-base's
  `ChunkScheduler` hook contract (`onChunkBuilt`/`onChunkDisposed` that flora, fauna, and
  networks attach to) + EZ-Tree-Demo's recycled chunk pool and direction-prioritized
  prefetch. One worker, one transport (bm-base shipped a second, dead worker-pool path —
  not again).
- **Ground cover** (grass and similar dense instancing) bypasses chunks and uses the
  `magnetic-sense-webxr` model: **additive density layers** — a sparse far grid supplies
  the baseline, medium and dense grids add only their density *difference*, so zone
  boundaries drop a supplement instead of popping an LOD and nothing stacks full-detail
  grids — plus **view-directed coverage**: a complete underfoot circle, then fixed
  sectors whose profiles trade horizontal spread for forward range. Normal movement
  changes grid origins, instance counts, and sector visibility only; placement buffers
  rebuild solely on setting edits. Coverage profiles and per-layer counts are
  perf-governor knobs by construction (§1.5, §11).
- **One animal substrate.** bm-base had persistent boids, a second mosquito system, and
  per-event GLB clones of the same animals — three implementations, three material paths.
  Here: `beings/` owns instanced actor pools + drivers (boids, baked routes via the route
  atlas, scripted event drivers). Scripted events *drive actors from the shared pool*
  rather than loading their own copies.

## 8. Dramaturgy, audio, language

**Runtime owns plain schedule JSON**: per-sense envelopes (keyframed 0..1 curves),
narration cue times, audio gains — played by `core/schedule` against the clock. There are
two schedules: the **tutorial** (a short scripted mini-course confirming the visitor can
steer — e.g. targets to fly through — with its own mini-schedule) and the **piece**.

- Authoring: dev-console timeline/envelope editor using the proven tune-in-browser →
  export JSON → commit loop. If Theatre.js's curve editor is wanted, it is a **dev-only
  authoring tool that exports baked JSON** — never a runtime dependency, never a second
  authority. (bm-base's worst incident was a schedule-editor UI that drove nothing while
  Theatre's committed state actually ran the show.)
- **Language is a session parameter (DE/EN)**, chosen by staff on the operator page when
  arming a session. `script/de.md` and `script/en.md` are both shippable content; narration
  assets are addressed as `narration/<lang>/<cueId>`. Cue *times* are shared; only the
  audio files (and any on-screen copy) switch.
- **Audio plays in the headset** (carried by the stream alongside the video).
- **The drone-organ synth is integrated as a sound engine without its UI**: the Tone.js
  patch graph becomes `src/audio/organ/`, driven by schedule envelopes and sense signals
  like every other audio layer. The old iframe/`window.__bmFrame`/host-pumped-rAF bridge —
  bm-base's most fragile seam — is gone; the patch-cable UI stays in the old repo.
- Everything audio is slaved to the clock so seek/pause behave in rehearsal.

## 9. M5: broadcast server, firmware, setup page

### Decided transport

The M5StickC Plus2 becomes a **plain-WebSocket broadcast server on the station network**.
The experience page runs on `http://localhost`, so it may open `ws://<m5>` directly — no
relay, no TLS, no BLE, no pairing token. Clients (experience, operator page, setup
diagnostics) subscribe and receive the same frames. The device announces itself via
mDNS/UDP beacon; **because two stations share one network, every frame carries `deviceId`
and each station's config binds it to exactly one M5**. The station server surfaces
"wrong/unknown device visible" as an operator warning instead of silently steering with
the neighbour rig (bm-base's bridge accepted any device socket and let the last frame
win — not again).

Keyboard remains a fully supported control source (works-in-any-state rule): the piece is
playable with no device at all.

### Firmware (`firmware/m5-broadcast/`)

- In-repo, PlatformIO, Arduino framework. **Fix the board def**: `board = m5stick-c-plus2`
  (bm-base shipped `m5stick-c` + phantom PSRAM flags) and add **GPIO4 power-hold** so the
  device survives on battery.
- Keep from the old firmware: M5Unified IMU read, accel-only pitch/roll estimate, external
  button on GPIO26 with firmware edge detection, NVS `Preferences` config storage, the
  self-owned reconnect philosophy, LCD as diagnostics surface.
- **Pipeline split by ownership** (stages ported from the 50-test TS pipeline; tests come
  along): `normalize → axis-map → calibrate` run **on the device** (calibration persisted
  in NVS at the rig — one rig, one zero, every client agrees). `safety → auto-neutralize →
  smooth` run **in the client** as a *configurable rig profile*. The old ICAROS rest-pose
  numbers (`restRoll:-0.8` etc.) are the starting profile for these rigs, but they are
  per-station config, not constants.
- **One protocol module** (`shared/protocol/`): TS types and the JSON field names the
  firmware emits, plus a single firmware version constant surfaced in the `register`
  message and *checked by the app* with an operator-visible warning (the old stack kept
  the version string in three repos and checked it in none).
- Keep the wire contract that already proved itself: `ControlFrame` with pitch/roll in
  -1..1, `quality` 0..1 where **`quality: 0` means "nothing is steering" and is a normal
  state, not an error**, plus one-frame `buttonDown`/`buttonUp` edges latched for fast
  render loops.

### Setup page (`setup.html`)

Operator/technician-only, replaces the old `pair.html` and adds what it never had:

1. **Flashing in the browser** via esp-web-tools (Web Serial): CI builds the PlatformIO
   binary and a `manifest.json` per release; the operator clicks "Install", no Python, no
   PlatformIO on the station. (**SPIKE H1**: esp-web-tools flash of a blink build on the
   Plus2 with the corrected board def.)
2. **Configuration** over the salvaged USB-serial newline-JSON protocol —
   `configure / diagnose / reboot` **plus `getConfig` (read-back of what is actually
   stored) and `factoryReset`**, which the old protocol lacked. Config surface: WiFi
   credentials of the station network, `deviceId` (= station identity), rig profile
   defaults. No server URL — the device *is* the server.
3. **Diagnostics**: live ±45° level pad with staleness detection, redacting log, and a
   device-side reachability self-test (the old `tcpProbeOk` idea inverted — the device
   proving its own network view is what makes setup debuggable).
4. Reuse directly: the Web Serial `readLoop()` newline framing with runaway guard, the
   redact filter, the writer lifecycle.

## 10. Session, operator page, headset agent

### 10.1 Session state machine (`src/session/`)

The exhibition flow is an explicit state machine, owned by the app, mirrored to the
operator page:

```
idle ──staff: arm──► boarding ──staff: tutorial──► tutorial ──staff: start──► piece
 ▲                   (see-through,                (scripted                 (schedule
 │                    visitor on rig)              mini-course)              runs)
 └──staff: reset──── return ◄──schedule end / staff: safety-exit ────────────┘
                     (fade to white → see-through)
```

- **Staff arm and start every phase**; the M5 button is an input *within* phases (e.g.
  confirming in the tutorial), not the session trigger.
- **Safety exit is available from every state** and does the same thing everywhere: fade
  the world to white, command the headset agent back to see-through, keep audio calm.
- **Missing acknowledgement = do not advance.** Every staff phase button gates on the
  relevant *confirmed* state (agent / streaming / M5 as applicable); a stale connection,
  lost tracking, or missing acknowledgement blocks the transition with an operator-visible
  reason. Staff can override explicitly (the agent is optional, §10.3) — never silently.
- Language (DE/EN) is fixed at `arm` time for the whole session.

### 10.2 Operator page (`operator.html`)

Runs on the second monitor of the station PC, served from the same localhost server.
Scope (decided): **session control, status monitoring, live visitor view** — deliberately
*not* a timeline/sense-override surface (that is the dev console's job, which remains
available for rehearsal).

- **Session control**: the state-machine buttons above, language toggle, volume.
- **Monitoring**: M5 connected/last-frame-age/calibration state (+ wrong-device warning),
  app FPS/frame-histogram summary, headset battery + worn state + streaming status (from
  the agent, §10.3), audio state. One glance answers "is everything OK".
- **Live visitor view**: the app mirrors its rendered frame to the operator page (same
  machine — a scaled-down copy at reduced rate is enough; no PICO API involved).
- Transport between pages: the station server brokers messages; the experience page and
  operator page each hold one WebSocket to `localhost`. No polling, no BroadcastChannel
  special cases.

### 10.3 Headset agent (`headset-agent/`)

Research result: **PICO exposes no PC-side API** for passthrough or telemetry. The
enterprise capabilities live in **on-device APIs** (PICO enterprise/ToB SDK:
`EnableSeeThroughManual`, `OpenVSTCamera`, `SwitchSystemFunction`, kiosk/app control) —
available because the stations use **PICO 4 Enterprise**. Therefore each headset runs a
small agent app that connects to the station server over the network and provides:

- **See-through switching (the decided XR model)**: in `idle`/`boarding` and on
  `safety-exit`/`return`, the visitor sees the real room via native see-through; on
  `tutorial`/`piece` start the agent hands the foreground to the PICO Business Streaming
  client (streamed VR fades in from white). Passthrough is never blended *under* streamed
  content — it is **switched**, which the enterprise APIs support.
- **Telemetry backstream**: battery, proximity/worn state, streaming-client
  foreground/connection state → station server → operator page. This replaces the vague
  "PICO API backstream" — the agent *is* the backstream.
- Supplementary PC-side telemetry: the station server may additionally query **OpenVR**
  (SteamVR) for device/tracking state; the PICO Business Streaming client's minimal
  "connection established" check is used if accessible.

**Agent protocol discipline** (proven in `../experiments/pico-remote-control`): every
agent command is correlated and distinguishes **requested → pending → headset-confirmed**
state — a successful socket `send()` is never proof the headset applied anything. The
operator page renders confirmed state only; `shared/protocol/` carries the correlation
ids and state tags.

**SPIKE P1 (highest-risk item in the project):** on real hardware, in this order:

1. **Business Streaming seethrough first.** PICO Business Streaming 2.2 (2026-06)
   officially lists "Seethrough during streaming" for specific Enterprise device/software
   combinations (source survey:
   `../experiments/pico-remote-control/docs/enterprise-kiosk-and-passthrough.md`). If it
   works on our exact matrix (§14, item 6), boarding/safety see-through comes from the
   streaming client itself and the agent shrinks to a telemetry-only app.
2. **Agent-driven handover as the in-spike fallback:** validate the
   agent ↔ streaming-client foreground handover (both directions, including "streaming
   client reconnects cleanly after being backgrounded"), see-through control from the
   agent, and telemetry access.

Record the outcome with its full hardware/software matrix (§12). Either way, the session
state machine treats the agent as optional: if the agent is unreachable, staff fall back
to guiding the visitor manually (headset gestures / removal) and the operator page shows
agent-degraded state — the piece itself is unaffected.

### 10.4 Headset provisioning and diagnostics (`station/tools/headsetctl/`)

The M5 has a full provisioning story (§9); the headsets get one too, on the pattern
proven by `picoctl` in `../experiments/pico-remote-control`. This is a maintenance
plane, never part of runtime control:

- **`headsetctl`** — a small tethered technician CLI over USB-C ADB: inspect device/OS
  versions, install the agent APK and streaming client, fire launch intents, reboot,
  screenshot, and open a bounded read-only scrcpy mirror (≤640 px, ≤15 fps, its failure
  isolated from everything else).
- **Kiosk/boot configuration** via PICO Business Device Manager: the streaming client
  (or agent) is pinned as the boot foreground app, so a power-cycled headset returns to
  a known state without anyone touching headset menus.
- **scrcpy is diagnostics, not operations.** The operator page's live visitor view stays
  the local render mirror (§10.2); but in `idle`/`boarding` and during failures the
  headset shows its own OS/streaming UI, which the PC render cannot show. The scrcpy
  mirror answers "what is the visitor actually seeing" — tethered and technician-only,
  since headsets are untethered in operation.

### 10.5 Explicitly rejected alternatives (recorded so they aren't re-litigated)

- **Blended passthrough under PC-streamed content** — architecturally impossible: the
  headset cameras never reach the PC, and PICO's streaming clients cannot composite
  passthrough under a streamed frame. WebXR `immersive-ar` does not help: desktop Chrome
  has no AR runtime; AR sessions only exist where the browser runs on the camera-bearing
  device. Business Streaming 2.2's "Seethrough during streaming" does not soften this
  verdict: it switches to the camera view during a stream rather than compositing
  passthrough under streamed frames — it supports the switching model of §10.3, not
  blending.
- **Running the app in the PICO's on-headset browser** — would enable real `immersive-ar`
  but sacrifices the desktop GPU, the streaming pipeline, and the operator architecture.
  Not planned — but no longer a mere thought experiment: `../experiments/pico-remote-control`
  proves the essentials on real hardware (persistent `immersive-ar` session on a PICO 4
  Ultra Enterprise, remote world switching and passthrough ↔ opaque presentation changes
  with no further user gesture, over a plain WebSocket). If SPIKE P1 fails on both paths,
  this is a runnable, evidenced escape hatch: TSL falls back to WebGL2 in the PICO
  Browser, and §1.5's runtime capacity knobs turn the same app down to standalone
  budgets. Caveat: the demo's `alpha-blend` passthrough is a browser-rendered capability
  and does not transfer to the streaming topology — the rejection above stands.
- **BLE / Web Bluetooth for the M5** — viable on desktop Chrome, but pointless once the
  page is a localhost secure context on a station network; plain WS is simpler and also
  serves the operator/setup pages.
- **TLS on the ESP32, relay processes, pairing tokens** — the localhost origin removes
  their reason to exist.

## 11. Performance governance

- **Budgets in CI**: the Playwright harness from EZ-Tree-Demo (frame histogram p50/p95/p99,
  draw-call and triangle ceilings per profile) becomes a repo quality gate. Profiles:
  `desktop-dev` and `station` (the actual PC spec, 90 Hz stereo + streaming encode
  headroom — the encoder steals GPU time; budget for it).
- **Runtime governor**: frame-histogram-driven tier degradation turning PerfRouter knobs
  (render scale, instance counts, particle draw ranges, ground-cover coverage profiles,
  compute skip radii). All knobs work at runtime by construction (§1.5).
- **No measurement overhead in the audience path**: perf sampling and GPU timestamp queries
  exist only while the ops HUD is open (bm-base permanently wrapped `renderer.render`).
- **Known ceilings from the old stack** (starting envelope, to be re-measured on the
  station PC): 400k scent particles, ~590k grass blades.

## 12. Quality gates

- `bun test` — everything in `core/`, `control/` (the ported 50 pipeline tests), `session/`
  state machine, world topology/height-field/lattice math, schedule player. All pure
  functions by design.
- `tsc` strict profile + Biome lint **and format** (the full bm-base flag set and formatter
  config) — from the first commit; nothing is ever excluded from the typecheck, and
  formatting is CI-enforced, never editor-dependent.
- **One gate command**: `bun run check` chains format check, lint, typecheck, and
  `bun test`, and CI runs exactly that command on every push — the same one a human runs
  locally. bm-base had all the scripts but no CI enforcement, which is precisely what
  decayed. Tests are not a phase: new pure logic lands with its tests in the same change.
- Playwright perf harness with per-profile budgets — one parameterized harness, no
  machine-specific paths (the old repo had ten hardcoded macOS one-offs).
- **CPU/GPU height agreement**: a readback test evaluates the TS height mirror against the
  TSL terrain height over a grid of sample points. The floating-grass failure mode is a
  red test, not a visual bug hunt (§7).
- CI additionally builds the firmware + esp-web-tools manifest, and the headset-agent APK,
  so app, firmware, and agent cannot drift apart unnoticed.
- **Dated hardware evidence.** Every spike result (R1/P1/H1) and every station acceptance
  run is recorded with its exact matrix: headset edition + model number, PICO OS,
  streaming-client/TobService versions, GPU/driver, build revision. A result without its
  matrix is not evidence. (Methodology:
  `../experiments/pico-remote-control/docs/validation.md`.)
- **Station acceptance protocol** (Phase 5): measurable gates on real hardware — a
  two-hour soak cycling the full session state machine, streaming and M5
  disconnect/reconnect recovery without manual repair, renderer resource counts returning
  to baseline after repeated cycles, and a bounded overhead budget if the scrcpy
  diagnostic mirror (§10.4) is used during measurement.
- Everything in the repo is English (AGENTS.md rule); German exists only as experience
  content (`script/de.md`, narration assets).

## 13. Build order

- **Phase 0 — spikes (throwaway):**
  **R1** WebGPU+WebXR (`XRGPUBinding`) on desktop Chrome + SteamVR + PICO Business
  Streaming, and the WebGL2-fallback delta;
  **P1** see-through path on real hardware: Business Streaming 2.2 seethrough first,
  then agent-driven handover + telemetry as the in-spike fallback (§10.3);
  **H1** esp-web-tools flash on the M5StickC Plus2 with the corrected board def.
- **Phase 1 — skeleton:** core (signals/bus/clock/schedule), renderer + XR rig, white void,
  glider flight with keyboard source, session state machine + minimal operator page
  (arm/start/reset + FPS), frame-loop phases. *Already "showable": void + wind + flight.*
- **Phase 2 — world:** height field (TSL + TS mirror + agreement test), clipmap terrain
  surface, population chunk streaming + pool, terrain material, ground cover, wind,
  ecology lattice, perf harness gating in CI on the station profile.
- **Phase 3 — senses:** one layer at a time against the SenseLayer contract, each landing
  with its tests, its audio counterpart, and its dev-console panel. Order by dramaturgy: scent → echo →
  motion → infrared → magnetic → network → UV → colour.
- **Phase 4 — dramaturgy & audio:** schedule player + authoring loop, narration (DE/EN) +
  drone-organ engine, tutorial mini-course, Overload/Return sequencing, credits.
- **Phase 5 — hardware & operations:** firmware, setup page, headset agent, headset
  provisioning (`headsetctl` + kiosk/boot configuration, §10.4), full operator page
  (telemetry + live view), rig-profile calibration at the actual stations, two-station
  network configuration (deviceId binding), station acceptance protocol (§12).

## 14. Remaining open items

1. **SPIKE P1 outcome** decides the final shape of the boarding/safety UX (agent-driven
   see-through vs staff-guided manual fallback).
2. **Tutorial content design** — the mini-course is decided as *scripted*; what the visitor
   actually flies through (targets? rings? a guide creature?) is a creative decision for
   Phase 4.
3. **Optional room-twin layer** — a rendered twin of the station space as a "ground truth"
   scene under the white world remains an artistic option (prologue/return "the room was
   always a construction" moment). The compositor architecture supports it as just another
   layer; no structural cost to deferring it.
4. **Futurium network specifics** — the shared station network is assumed to be one we
   control (router, DHCP reservations for the M5s). Confirm with the venue; house-IT
   constraints (client isolation) would break M5→PC traffic and must be ruled out early.
5. **Station PC spec** — needed to set the `station` perf budget (GPU model, encoder load
   of PICO Business Streaming at 90 Hz).
6. **Exact headset edition.** The `pico-remote-control` evidence hardware was a PICO 4
   **Ultra** Enterprise (model A9210); this document assumes PICO 4 Enterprise.
   Enterprise SDK APIs and Business Streaming 2.2's "Seethrough during streaming" depend
   on device model, PICO OS, and TobService versions — confirm the Futurium units' exact
   edition and versions before SPIKE P1, since spike results bind only to the tested
   matrix.
