# Open Decisions

Decisions that need discussion before implementation commits to a path. Do not
preempt them in code — ask. Until a decision falls, the current
[engineering standards](../engineering-standards.md) stand.

## 1. Delivery platform: standalone PICO vs Windows PC-VR streaming

- [Platforms](../platforms.md) keeps both targets and an open research
  question, prefers wired USB streaming, and keeps wireless streaming outside
  the installation baseline.
- The pre-import draft had decided the opposite corner: PC-VR through
  SteamVR/OpenXR with wireless PICO Business Streaming, a desktop-GPU
  performance budget, and the headset as a display only.
- Coupled to the headset integration model ([Headset](headset.md)). Until
  decided, the mobile-first performance rules in AGENTS.md stand.

## 2. Runtime coordination layer

**Partly decided (2026-09-01).** The virtual clock and the schedule authority
are settled and built — see
[Show Clock and Schedule Authority](../architecture-decisions.md). `src/dramaturgy`
owns show time and baked schedule data, `src/sound` owns audio playback, and
they meet only through `level-runtime.ts` and one cue-lookup contract. No event
bus, service locator, or singleton was needed.

**Extended (2026-09-01, revised 2026-09-02).** The operator page now hosts the
show in-process and commands it through one typed actions contract — see
[One Station Window](../architecture-decisions.md), which replaced the interim
localhost WebSocket broker. That is a direct-call surface with one owner on
each side, not an in-process bus: no topics, no registration, no lookup.

**Extended (2026-09-03).** One-shot staged moments — the animal passages — are
placed as a second facet of the same baked schedule and read by a pure
show-time lookup, not by a trigger channel. See
[An Animal Passage Is Scheduled Data, Not a Triggered Event](../architecture-decisions.md).
That removes the last concrete consumer the pre-import command bus was
proposed for.

Still open:

- The pre-import draft's in-process **command bus** and **perf router**. Neither
  has a concrete consumer yet, and the engineering standards still forbid global
  event buses, service locators, and hidden singletons. The station transport is
  not a precedent for one.
- The **session state machine** ([Session and Operator](session-operator.md)):
  `idle → boarding → tutorial → piece → return`, and which phase owns starting
  and stopping the show clock. *How* the operator page reaches the runtime is
  now settled; *what* it should reach beyond the clock is not.

## 3. Repository additions for installation work

**Partly decided (2026-09-01).** The first three landed, so their placement is
now fixed and the rest follow the same rule: **split by runtime, not by
feature.** Browser source lives under `src/`; a process that runs under Bun
lives in its own root folder, the way `tests/benchmark/` already holds the
Chromium runner that drives `src/benchmark`.

- **Operator page** → `src/conductor/`, entered from a second Vite page at
  `conductor.html` (since 2026-09-02 it hosts the show in-process — the wire
  that briefly lived in `src/station` is gone, and that folder now holds the
  deployment-config contract).
- **Station localhost server** → `station/`, at the repository root, importing
  `src/station` and exporting nothing.
- **M5 firmware** (PlatformIO) → `firmware/m5/`, at the repository root; its
  wire contract lives in `src/m5/` and the flash/setup page in `src/flash/`,
  entered from a third Vite page at `flash.html` (landed 2026-09-01,
  [Controls and M5](controls-m5.md)).

Still open:

- The headset agent (Android) and a technician CLI. The pre-import draft's
  proposed repository layout remains non-binding.
