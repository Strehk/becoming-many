<!--
Purpose: Preserve the 2026-09-02 performance-focused code review of PR #8 (grass-clipmap) as an improvement backlog.
Scope: The grass-clipmap module, its settings and level wiring, plus two non-performance catches found on the way.
Boundary: Findings are static-analysis reasoning against PR head ab526b4, verified per finding but not re-measured; a parallel performance review and rewrite is in progress, so reconcile each item against that work before applying it.
-->

# Performance Review — grass-clipmap (PR #8) — 2026-09-02

## Status

**This file needs a look.** It records the findings of an automated
high-effort review of PR #8 (`grass-clipmap` → `main`, head `ab526b4`).
A separate performance review and rewrite is happening in parallel; before
acting on any item below, check whether the rewrite has already changed or
removed the code in question. Line numbers refer to the PR head.

Fifteen candidate findings were adversarially verified; two were refuted and
three cut (see the last section). Ten survived, ranked most severe first.

## Findings

### 1. Clipmap renders at full cost before the echo cue (P0)

`src/levels/level-runtime.ts:635` composes the module ungated while terrain,
vegetation, and rocks ride the echo ShowGate. In a show run the echo cue lands
at t = 134 s (`piece-schedule.ts:41`); until then the field's update and all
chunk draws run every frame — by the PR's own measurements +78 draw calls,
+0.3 M triangles, ~2 ms p95 — rendering exactly the background color, because
World Fade color-mixes opaque materials instead of culling them.
**Fix:** register the module under the echo gate, or drive `group.visible`
from `setPresence(0)`.

### 2. Shipped tunables contradict their own recorded measurements (P0)

- `grass-clipmap-settings.ts:134` — `uniformSegmentIndex: 1` (three segments)
  while its own comment argues for index 2 ("2.31 M vs 2.65 M triangles,
  worth 0.2–0.5 ms p95").
- `echo.level.ts:49` — `fullDensityRadiusMeters: 14` is the exact value
  [performance.md](performance.md) records as rejected ("reads as bare
  ground" from flight height).
- `echo.level.ts:55` — `bladeHeightMeters: 3` is the demo value its own
  comment calls "too tall"; the intended 2.1 m reach requires ~2.1, since the
  shader height factors are capped at 1.0.
- `echo.level.ts:44` — `tuftsPerSquareMeter: 21.85` is covered by no recorded
  measurement.

**Fix:** apply the measured choices, or record why they were overridden.

### 3. Height-field refill steps blow the stream budget 3× (P0)

`grass-clipmap-settings.ts:227` — `rowsPerStep: 8` makes one uninterruptible
StreamQueue step fill 1536 texels (~1.5 ms by the module's own 35.8 ms /
36 864-texel measurement) against the 0.5 ms per-frame stream budget
(`world-settings.ts:13`; `stream-queue.ts:85` checks the deadline only
between steps). A 32 m recenter queues 24 such steps — a stutter train every
few seconds of flight that also starves terrain jobs on those frames.
**Fix:** `rowsPerStep: 2` (~0.37 ms/step) still completes a recenter in about
a second.

### 4. The detail-tier system is dead code at runtime (P1)

`grass-clipmap-settings.ts:144` — `detail.byDistance: false` makes
`chooseDetailIndex` always return `uniformSegmentIndex`, so the cheap
`GRASS_WIND_SIMPLE` tier is unreachable and a blade at 55 m pays the full
flutter/gust/normal-bend vertex cost of a near blade. 13 of 16 geometries and
9 of 12 ShaderMaterials per level are built, effect-patched, held, and
disposed without ever being bound; the `GRASS_LIT` path and its lighting
settings block are likewise dead in every shipped level.
**Fix:** enable `byDistance`, or build only the reachable rows.

### 5. Refill job starves behind terrain and publishes stale windows (P1)

`grass-clipmap.ts:137` — `createRefillJob` sets no priority, so the refill
runs at default priority 1 behind terrain's priority-0 jobs, and the
`if (resources.refilling) return;` guard (`grass-clipmap.ts:117`) freezes the
pending origin at the stale camera position while the job is starved. Under
sustained flight the window can publish with the camera already outside it;
blades beyond the window sample the clamped edge texel and root at wrong
heights until the next recenter completes.
**Fix:** give the refill terrain's priority, or re-run `beginRecenter` when
`needsRecenter` fires again mid-refill.

### 6. Every recenter refills all texels despite 84–92 % overlap (P1)

`grass-height-field.ts:105` — `beginRecenter` resets `nextRow = 0`, so a 32 m
recenter (a 16-texel window shift) recomputes all 192 × 192 texels — ~30 ms
of redundant `groundYAt` + `zoneAt` CPU work plus a full 147 KB texture
re-upload, re-paid every 32 m of flight.
**Fix:** shift the retained block inside `data` and fill only the newly
exposed L-shaped band. (Toroidal wrapping is not drop-in because of the
LinearFilter seam blending.)

### 7. Height texture is ~4× oversized for what is ever sampled (P1)

`grass-clipmap-settings.ts:223` — `sizeTexels: 192` (a ±191 m window) is
sized to clipmap coverage, but no vertex samples past the jittered fade end
(~66 m) plus recenter drift (~32 m): the shader's only height fetch sits
after the fadeEnd early-out and chunks past `fade.endMeters` are
CPU-invisible. Roughly 75 % of the texels filled on load and on every
recenter are never fetched.
**Fix:** derive `sizeTexels` from `fade.endMeters + recenterMeters`
(~96–128 texels), cutting first fill and every recenter roughly 3–4×.

### 8. CPU frustum cull can pop ridge-top grass (P2)

`grass-clipmap-field.ts:452` — the shared per-chunk bounding sphere
(center y = 1, radius `chunkSize * 0.7072 + 5`) budgets ~18 m of vertical
slack at a chunk corner, but blade Y comes entirely from the height texture
and ground reaches +27.5 m plus 3 m blades — the same flat-probe defect this
PR fixed in the GPU cull. With the camera high and pitched down near a
frustum edge, a chunk with on-screen ridge grass can be culled.
**Fix:** set `frustumCulled = false` like every sibling displaced-vertex
module, or cover `[minElevation, maxElevation + bladeHeight]` in the sphere.

## Non-performance catches

### 9. `isLevelName` accepts Object.prototype keys, now reachable by URL path

`level-catalog.ts:68` — `value in LEVEL_CATALOG` lets `constructor`,
`toString`, etc. pass as level names, and the new path routing
(`main.ts:61`) exposes it to every URL path: `/constructor` silently starts a
featureless world with the show suppressed, on a headset with no console.
**Fix:** `Object.hasOwn(LEVEL_CATALOG, value)`.

### 10. Diagnostics overlay defeats itself and leaks a WebGL2 context

`headset-diagnostics.ts:19` — the `?diagnostics=1` overlay is a fixed,
92 %-opaque, pointer-events-auto sheet with no dismiss path: it hides the
world it exists to diagnose and swallows the click desktop-controls needs for
PointerLock. `describeGraphics` also creates a throwaway WebGL2 context
before the real renderer's without releasing it — on context-capped headset
browsers the diagnostics flag can itself produce the empty world it reports.
**Fix:** top-strip / pointer-events-none layout; release the probe context
via `WEBGL_lose_context.loseContext()`.

## Refuted or cut

- **Benchmark baseline change** — refuted: the file asserts exact equality
  and the regeneration caught up on 61 commits of stale drift.
- **Thermal instanced-header multiply** — refuted as stated: it lands only
  on vertices surviving every discard path.
- **Synchronous 35.8 ms first fill** — real but pre-first-frame, documented,
  and the established house pattern.
- **`edgeJitter = fract(rank)` bias** — real but sub-visual: the height fade
  reaches zero before the cut fires.
- **`process.env` HTTPS wiring in `vite.config.ts`** — arguable
  [AGENTS.md](../AGENTS.md) "no environment configuration" boundary case;
  a question for the author, not a finding.
