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

Still open:

- The pre-import draft's **command bus** and **perf router**. Neither has a
  concrete consumer yet, and the engineering standards forbid global event
  buses, service locators, and hidden singletons.
- The **session state machine** ([Session and Operator](session-operator.md)):
  `idle → boarding → tutorial → piece → return`, which phase owns starting and
  stopping the show clock, and how the operator page reaches it.

## 3. Repository additions for installation work

- Coming areas: operator page, M5 firmware (PlatformIO), headset agent
  (Android), a shared wire-protocol module, a station localhost server, and a
  technician CLI.
- Placement and naming are decided when the first of these lands; the
  pre-import draft's proposed repository layout is not binding.
