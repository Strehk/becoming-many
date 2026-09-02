# Open Decisions

Decisions that need discussion before implementation commits to a path. Do not
preempt them in code — ask. Until a decision falls, the current
[engineering standards](../engineering-standards.md) stand.

The delivery platform is no longer open. This repository targets Windows PC VR
through SteamVR and wired PICO Business Streaming; a later standalone PICO
edition belongs in a separate reduced fork. See [Platforms](../platforms.md)
and [Headset](headset.md).

## 1. Runtime coordination layer

**Partly decided (2026-09-01).** The virtual clock and the schedule authority
are settled and built — see
[Show Clock and Schedule Authority](../architecture-decisions.md). `src/dramaturgy`
owns show time and baked schedule data, `src/sound` owns audio playback, and
they meet only through `level-runtime.ts` and one cue-lookup contract. No event
bus, service locator, or singleton was needed.

**Extended (2026-09-01).** The operator page now reaches the show clock, over a
localhost WebSocket broker — see
[Station Transport and the Conductor Page](../architecture-decisions.md). That is
a cross-process wire with one closed message union and one owner on each side,
not an in-process bus: no topics, no registration, no lookup.

**Target transport decided (2026-09-02).** The isolated VR and Conductor pages
run on the same PC and origin, so the broker is replaced by one
`BroadcastChannel` after the entry split. The current broker remains an as-built
fact until that migration, not an open topology choice.

Still open:

- The **session state machine** ([Session and Operator](session-operator.md)):
  `idle → boarding → tutorial → piece → return`, and which phase owns starting
  and stopping the show clock. *How* the operator page reaches the runtime is
  now settled; *what* it should reach beyond the clock is not.

## 2. Repository additions for installation work

**Partly decided (2026-09-01).** The first three landed, so their placement is
now fixed and the rest follow the same rule: **split by runtime, not by
feature.** Browser source lives under `src/`; a process that runs under Bun
lives in its own root folder, the way `tests/benchmark/` already holds the
Chromium runner that drives `src/benchmark`.

- **Operator page** → `src/conductor/`, entered from a second Vite page at
  `conductor.html`.
- **Shared wire protocol** → `src/station/`, with the browser-side client
  beside it.
- **Current station localhost server** → `station/`, at the repository root.
  It is removed when the confirmed same-origin `BroadcastChannel` migration
  lands; do not treat its location as a future extension point.
- **M5 firmware** (PlatformIO) → `firmware/m5/`, at the repository root; its
  wire contract lives in `src/m5/` and the flash/setup page in `src/flash/`,
  entered from a third Vite page at `flash.html` (landed 2026-09-01,
  [Controls and M5](controls-m5.md)).

Still open:

- Whether concrete operator requirements justify a small Windows adapter for
  the native PICO Business Streaming SDK. Do not add an Android headset agent:
  the selected streaming product already owns the headset-side runtime.
- A technician CLI. The pre-import draft's proposed repository layout remains
  non-binding.

The pre-import in-process command bus and performance router are rejected. No
current consumer requires them, and the engineering standards forbid global
event buses, service locators, and hidden singletons.
