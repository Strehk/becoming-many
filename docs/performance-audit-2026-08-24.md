<!--
Purpose: Preserve the 2026-08-24 browser performance audit as a reproducible evidence snapshot.
Scope: Test Level runtime, rendering, streaming, assets, startup, and open PICO acceptance.
Boundary: Measurements are desktop Chromium evidence and do not constitute physical PICO 4 acceptance.
-->

# Browser Performance Audit — 2026-08-24

## Executive Summary

The current Test Level is **not ready for the stable 90 FPS PICO 4 target**.
The production build already averages about **16.1 ms per frame** on an Apple
M4, with **26.4 ms p95**. The 90 FPS frame budget is **11.11 ms**, and about
72% of the repeated browser frames exceeded that budget.

The dominant bottleneck is GPU-side geometry load, especially Vegetation.
Main-thread work, Terrain generation, Air Particles, Magnetic Sense, and Zone
Visualizer logic are not the primary problems in the current browser profile.

Physical PICO 4 acceptance remains open because no ADB device was connected
during this audit.

## Measurement Baseline

| Area | Result |
| --- | --- |
| Browser | Chrome 151, hardware-accelerated ANGLE/Metal on Apple M4 |
| Standard viewport | 1600 × 900, effective device pixel ratio 1 |
| Production idle frame time | 16.08 ms mean, 26.4 ms p95, 32.8 ms p99 |
| Repeated development measurements | 16.56 ms mean of means, 27.2 ms mean p95 |
| 90 FPS frame budget | 11.11 ms |
| Frames above 90 FPS budget | About 72% |
| Initial render load | 55 calls, 5,898,709 triangles, 58,320 points |
| Render load during flight | 6.30–7.17 million triangles depending on zone |
| Idle main-thread module work | About 0.49–0.71 ms per frame |
| Production cold start | 543 ms median runtime startup, 819 ms median first frame |
| Production cold-start transfer | About 19.4 MB |
| Ten-minute soak | No errors or long tasks; queue peak 243 of 256 |
| Physical PICO 4 | Not measured; acceptance remains open |

## Detailed Findings

| Priority | Problem | Evidence | Cause | Recommended action |
| --- | --- | --- | --- | --- |
| **P0** | Total render load misses the 90 FPS target | 16.1–16.6 ms mean, 26–27 ms p95, and about 72% of frames above 11.11 ms | The scene renders about 5.9 million triangles at the initial position and up to 7.17 million while moving. CPU work remains low. | Establish a strict triangle and visibility budget before adding features. The desktop result must be comfortably below 11.11 ms to leave PICO compositor and browser headroom. |
| **P0** | Vegetation is the largest individual bottleneck | Without Vegetation: 11.67 ms and 1.07 million triangles. Full Vegetation: about 15.93 ms and 5.90 million triangles. Half density: 12.52 ms and 3.37 million triangles. | Deciduous tree sources contain 7,096–8,520 triangles per instance. Individual instanced parts contribute about 330,000–760,000 visible triangles. | First reduce Vegetation density and produce mobile LOD0 assets, especially for deciduous trees. Avoid a new Vegetation architecture until these content reductions are measured. |
| **P0** | One view distance expands nearly every resident system | Reducing view distance from 180 m to 128 m produced 9.41 ms and 2.82 million triangles. At 64 m the test reached the 8.33 ms host limit with 856,000 triangles. | [`viewDistance: 180`](../src/levels/test.level.ts) drives Terrain, Vegetation, Grass, and particle windows together. | Reduce the Test Level view distance first. Introduce separate module distances only where the visual design demonstrably needs distant Terrain but closer dense Vegetation or Grass. |
| **P1** | Static instance pools cannot be spatially culled | All inspected tree, shrub, and rock pools use `frustumCulled = false`. | [`instanced-model-pool.ts`](../src/utils/asset-loader/instanced-model-pool.ts) keeps one world-spanning `InstancedMesh` per model part. Simply enabling culling would not help much because the global bounds usually intersect the frustum. | After density and LOD reductions, test a small number of coarse spatial batches and update their bounding spheres after recycling. Measure the draw-call tradeoff. |
| **P1** | Grass contributes almost one million triangles | Grass contributes exactly 985,608 triangles. Removing it reduced the mean to 12.07 ms. Half density reached 12.81 ms and is insufficient by itself. | At 180 m the preload ring keeps a 9 × 9 chunk window. The global mesh in [`grass-field.ts`](../src/modules/grass/grass-field.ts) is not spatially cullable. | Reduce Grass visibility distance and preload first, then density. Preserve the existing partial buffer update path. |
| **P1** | Streaming queue has little reserve | During a ten-minute deterministic flight, the queue averaged 46 jobs and peaked at 243 of 256. It recorded 228 obsolete jobs and zero rejections. | Large resident content windows continuously schedule new chunk work. The current queue works, but only 13 slots remained at peak load. | Do not increase capacity first. Reduce resident content windows, then measure queue maximum, rejections, obsolete work, and time-to-ready on PICO. |
| **P2** | Static pool publication uploads broad matrix ranges | Desktop CPU time remains manageable, but the path is a possible mobile memory-bandwidth risk. | Each publication compacts active instances and marks broad matrix update ranges in [`instanced-model-pool.ts`](../src/utils/asset-loader/instanced-model-pool.ts). | Profile this path on PICO after the P0 fixes. Only introduce stable spatial slots or smaller upload ranges if hardware evidence identifies uploads as a bottleneck. |
| **P2** | Startup waits for all enabled assets | Median first frame was 819 ms with about 19.4 MB transferred. The main production bundle is about 680 kB minified and 176 kB gzip. | [`level-runtime.ts`](../src/levels/level-runtime.ts) waits for all enabled Vegetation, Rock, and Animal assets before starting the world. Individual GLBs are about 2–3.4 MB. | Show the renderer and a minimal background earlier, then load nearby assets first. Evaluate Meshopt or Draco and KTX2 only with browser and PICO comparisons. |
| **P2** | Animals use many draw calls for little geometry | Visible animals contribute only about 8,000 triangles but roughly 20–24 draw calls. No desktop FPS effect was measurable. | The assets contain multiple skinned mesh parts, although at most four animals are visible. | Keep this below Vegetation and Grass work. If PICO is draw-call limited, simplify animal materials and source meshes before adding runtime batching. |
| **Guardrail** | Desktop Retina is not rendered at native DPR | The browser reported DPR 2, but the canvas remained at CSS resolution. | [`world-runtime.ts`](../src/world/world-runtime.ts) sets renderer size without calling `renderer.setPixelRatio()`. | Keep the current setting for performance. Do not increase desktop DPR before profiling; XR uses a separate framebuffer resolution and must be measured on PICO. |

## Diagnostic Counterfactuals

These short A/B runs isolate likely contributors. They are diagnostic evidence,
not acceptance measurements.

| Variant | Mean frame time | p95 | Render load | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Full Test Level | 15.93 ms | 25.6 ms | 5.90 M triangles | Short-run comparison baseline |
| No Vegetation | 11.67 ms | 22.6 ms | 1.07 M triangles | Largest single improvement |
| Half Vegetation density | 12.52 ms | 23.9 ms | 3.37 M triangles | Useful but insufficient alone |
| No Grass | 12.07 ms | 22.4 ms | 4.91 M triangles | Second-largest content contributor |
| Half Grass density | 12.81 ms | 24.3 ms | 5.40 M triangles | Useful but insufficient alone |
| 128 m view distance | 9.41 ms | 16.7 ms | 2.82 M triangles | Major improvement, but p95 still misses 90 FPS |
| 64 m view distance | 8.33 ms | 9.2 ms | 856 k triangles | Reaches the 120 Hz desktop host limit |
| Runtime only | 8.33 ms | 9.2 ms | No world geometry | Confirms the browser's 120 Hz host baseline |

Air Particle density, Magnetic Sense, and Zone Visualizer toggles produced no
reproducible performance difference in the current desktop profile.

## Current Non-Bottlenecks

| System | Result |
| --- | --- |
| Terrain | The isolated diagnostic path rendered 28,672 triangles and reached the 120 Hz host limit. |
| Air Particles | 58,320 points in one draw call; halving density had no reproducible effect. |
| Magnetic Sense | Disabling it produced no measurable difference. |
| Zone Visualizer | Disabling it produced no measurable difference. |
| JavaScript main thread | Idle module work stayed below 1 ms per frame; no long tasks were recorded. |
| Memory | No monotonic growth was visible in the ten-minute soak, but a physical PICO soak is still required. |
| Static checks | 75 tests, type checking, linting, and production build passed. Fallow found no relevant dead-code or complexity issue. |

## Recommended Execution Order

| Step | Change | Measurement gate |
| ---: | --- | --- |
| 1 | Reduce total view distance or Vegetation visibility distance toward 128 m | Bring p95 clearly below 11.11 ms |
| 2 | Reduce deciduous-tree geometry and Vegetation density | Stay below roughly 2–3 million visible triangles |
| 3 | Reduce Grass range and preload, then density | Bring Grass well below 500,000 triangles |
| 4 | Test coarse spatial instance batches with current bounds | Remove offscreen geometry without a draw-call explosion |
| 5 | Profile streaming and buffer uploads on PICO | Preserve queue reserve and record zero rejections |
| 6 | Optimize startup assets and animal draw calls | Improve startup without adding runtime complexity |
| 7 | Run physical PICO acceptance | Stable 90 FPS during movement, passthrough, and soak |

## Conclusion

The runtime does not require an immediate architectural rewrite. The largest
near-term gains come from smaller content budgets, mobile tree assets, and
shorter Vegetation and Grass ranges. Spatial instance batching is a secondary
optimization and should follow measured content reductions.

Three.js frustum culling requires useful object bounds. A world-spanning
instance pool with `frustumCulled = false` cannot remove offscreen geometry,
while merely turning culling on for the same global bounds would normally keep
the whole pool visible. Coarse spatial batches with updated bounding spheres
are therefore the smallest credible culling experiment.

Desktop measurements detect the current bottlenecks but do not replace a
physical PICO 4 profile. PICO frame timing, compositor behavior, streaming
reserve, passthrough, recovery, and a long soak remain mandatory acceptance
gates.
