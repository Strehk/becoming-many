# Performance

Performance is a product requirement, not a late optimisation phase.

## Acceptance target

- Stable 90 Hz, an 11.11 ms frame interval, on the actual Windows-PCVR
  installation over USB-C.
- Acceptance includes the application, browser/XR host, compositor, encoding,
  transport, headset decoding, audio, and normal bounded streaming work.
- Mac browser and deterministic runs are regression instruments; they do not
  establish installation acceptance.
- Standalone PICO belongs to a separate project. Do not add speculative runtime
  paths or automatic lower-quality modes here.

## Runtime constraints

Keep one renderer, one render loop, fixed or explicitly bounded capacities,
recycled spatial windows, pooled resources, partial buffer publication, and
frame-budgeted jobs. The creator releases CPU, GPU, browser, worker, listener,
and audio resources.

Preparation should move required first-use work before visible playback without
creating a second world or uncontrolled hidden simulation. Cancellation and
late results obey the same ownership and bounded-work rules as normal startup.

Optimisation begins with measured current work. Prefer fewer draw calls, shared
compatible resources, low-cost opaque shaders, bounded updates, LOD, and correct
culling. Do not infer a speedup from code size, draw count, or theory alone.

## Evidence layers

Keep these claims distinct:

1. Static checks prove types, imports, and known invariants.
2. Deterministic benchmarks prove repeatable renderer counters and configured
   virtual workload.
3. Headed browser comparisons can attribute local CPU/GPU or browser behavior
   under matched conditions.
4. Normal show observations detect integration failures and sustained desktop
   regressions.
5. Only the actual Windows-PCVR installation can prove the 90-Hz target,
   transport behavior, headset comfort, and repeated visitor operation.

Every retained comparison names revision or artifact, route, viewport, browser,
GPU, warmup, workload, instrumentation, result, and limitation. Preserve one
decisive result in the owning issue. Do not commit raw frame arrays, repeated
dumps, screenshots of equivalent intermediate states, or chronological prose.

The deterministic benchmark reference changes only after explicit approval in
[#78](https://github.com/Strehk/becoming-many/issues/78). Never replace a failed
reference or unexplained measurement with a successful rerun.

## Current gates

- Performance-labelled work and its acceptance live in the
  [open performance issues](https://github.com/Strehk/becoming-many/issues?q=is%3Aissue%20is%3Aopen%20label%3Aperformance).
- Complete show, standalone Start, M5, reconnect, and repeated-visitor performance remain
  open on the installation hardware.

A measured regression blocks completion until it is removed or explicitly
accepted with comparable evidence.
