# Senses

The artistic rule is also the robustness rule: **senses layer, never swap** —
the world only ever grows denser. The void (white world, wind, flight) is the
base state; the piece must boot, fly, and end cleanly with zero sense modules
loaded. A sense that fails to load is logged and skipped; the piece still runs.

## Contract direction

Each sense is a content module under the existing `ModuleRuntime` lifecycle
(`load → activate → update → deactivate → unload`), plus:

- an **intensity signal 0..1 driven as a uniform** by the dramaturgy schedule —
  activation costs no recompile and no scene churn; intensity 0 means invisible
  and its GPU work is skipped.
- an optional **audio counterpart** faded by the same intensity signal
  ([Dramaturgy and Audio](dramaturgy-audio.md)).
- **composability**: a sense never imports or recolors a sibling module.
  Magnetic Sense already models this — a material effect that preserves the
  underlying presentation
  ([architecture decisions](../architecture-decisions.md)).

The Overload phase (every sense at once) must be the same rendering path as the
void — layers gated by uniforms, not scene swaps.

## Dramaturgy order

scent → echo → motion → infrared → magnetic → network → UV → colour.

## Reference-project extraction map

Sources are principle sources, not architectures to copy. All extracted
shaders are rewritten as GLSL ES 3.00 files per the decided rendering stack
([architecture decisions](../architecture-decisions.md)); TSL sources are
references only, never carried over.

| Source | What | Toward |
|---|---|---|
| scent-particles | single-drawcall route-atlas particle system (moving emitters, trail sampling) | scent sense |
| wurzeln | traffic-reinforced network topology (MST + kNN + BFS); instanced-tube growth shader | network sense — topology belongs in a worker (it is O(n²)) |
| bm-base | scent field, magnetic sky (mode weights as uniforms), motion trail ring buffer, sense compositor idea | respective senses — rewrite the TSL sources as GLSL |
| magnetic-sense-webxr | magnetic field contract coloring terrain + grass through one uniform set | magnetic sense (ground counterpart to the sky) |
| EZ-Tree-Demo | frame histogram + Playwright perf gates | performance harness (roadmap §2) |
