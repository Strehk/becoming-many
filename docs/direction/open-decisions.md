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

- The pre-import draft planned a bm-base-style core: named signals, a command
  bus, a virtual clock, a schedule player, and a perf router.
- The engineering standards forbid global event buses, service locators, and
  hidden singletons; the composition root is `level-runtime.ts`.
- Still needed eventually: one virtual clock plus a single schedule authority
  for dramaturgy ([Dramaturgy and Audio](dramaturgy-audio.md)) and a session
  state machine ([Session and Operator](session-operator.md)). How they
  integrate with the Level Runtime without violating the standards is
  undecided.

## 3. Repository additions for installation work

- Coming areas: operator page, M5 firmware (PlatformIO), headset agent
  (Android), a shared wire-protocol module, a station localhost server, and a
  technician CLI.
- Placement and naming are decided when the first of these lands; the
  pre-import draft's proposed repository layout is not binding.
