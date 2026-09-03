# Stabilization Roadmap

The core experience is largely implemented. This roadmap contains remaining
issue-backed work only; current facts belong in
[current-status.md](current-status.md), architecture rules in
[architecture.md](architecture.md), and detailed acceptance criteria in each
GitHub issue.

Issue numbers and titles below mirror the open issue list on 2026-09-03. Work
proceeds one focused issue at a time. Small product features may be added only
through a concrete issue.

## Performance

- [#13 — Choose One Grass Owner Using Current Measurements](https://github.com/Strehk/becoming-many/issues/13)
- [#16 — Eliminate Cold-Start CPU Spikes at Level Transitions](https://github.com/Strehk/becoming-many/issues/16)
- [#21 — Enforce the Performance Merge Gate](https://github.com/Strehk/becoming-many/issues/21)
- [#26 — Bring Scent Within the Frame Budget](https://github.com/Strehk/becoming-many/issues/26)
- [#32 — Reduce Thermal Fragment Cost](https://github.com/Strehk/becoming-many/issues/32)
- [#35 — Remove Redundant Test UI Runtime Cost](https://github.com/Strehk/becoming-many/issues/35)

## Stability, Security, and Installation

- [#9 — Complete the Application Lifecycle](https://github.com/Strehk/becoming-many/issues/9)
- [#12 — Stop Persisting and Logging Wi-Fi Passwords](https://github.com/Strehk/becoming-many/issues/12)
- [#14 — Bound Headset Diagnostics Lifecycle and GPU Probing](https://github.com/Strehk/becoming-many/issues/14)
- [#17 — Reset M5 State on Host Change](https://github.com/Strehk/becoming-many/issues/17)
- [#18 — Enforce M5 Liveness, Identity, Sequence, and Calibration](https://github.com/Strehk/becoming-many/issues/18)
- [#20 — Tighten the Material Shader Patch Contract](https://github.com/Strehk/becoming-many/issues/20)
- [#28 — Validate Every Consumer of Shared Wind Changes](https://github.com/Strehk/becoming-many/issues/28)
- [#29 — Smooth Animal Boundary Turns](https://github.com/Strehk/becoming-many/issues/29)
- [#33 — Validate XR Flight on a Physical PICO](https://github.com/Strehk/becoming-many/issues/33)
- [#42 — Diagnose Wired PCVR Startup on Windows, SteamVR, and PICO](https://github.com/Strehk/becoming-many/issues/42)
- [#46 — Auto-center the headset before every visitor flight](https://github.com/Strehk/becoming-many/issues/46)

## Cleanup and Architecture

- [#11 — Configure Fallow Architecture Boundaries](https://github.com/Strehk/becoming-many/issues/11)
- [#19 — Isolate Rehearsal, Test, and Conductor Entry Points](https://github.com/Strehk/becoming-many/issues/19)
- [#22 — Remove the Unused @material/web Override](https://github.com/Strehk/becoming-many/issues/22)
- [#25 — Rename Runtime Concepts by Current Ownership](https://github.com/Strehk/becoming-many/issues/25)
- [#27 — Tighten Scent Source Types](https://github.com/Strehk/becoming-many/issues/27)
- [#36 — Simplify Conductor Ownership and State Flow](https://github.com/Strehk/becoming-many/issues/36)
- [#38 — Tighten the M5 Control Boundary](https://github.com/Strehk/becoming-many/issues/38)
- [#39 — Deduplicate positive modulo inside the World domain](https://github.com/Strehk/becoming-many/issues/39)
- [#40 — Reuse the World cell random function in Grass](https://github.com/Strehk/becoming-many/issues/40)
- [#41 — Reduce Rocks and Vegetation runtime duplication](https://github.com/Strehk/becoming-many/issues/41)

## Small Product Features

- [#47 — Add a View-Guaranteed Encounter Module](https://github.com/Strehk/becoming-many/issues/47)
- [#48 — Add the Timed Bat Encounter](https://github.com/Strehk/becoming-many/issues/48)
- [#49 — Add the Timed Mosquito Swarm Encounter](https://github.com/Strehk/becoming-many/issues/49)
- [#50 — Rewrite and Integrate the Flight Tutorial](https://github.com/Strehk/becoming-many/issues/50)
- [#51 — Show End Credits in Immersive VR](https://github.com/Strehk/becoming-many/issues/51)

## Completion Gates

A change is complete only when its issue acceptance criteria and relevant static
gates pass. Performance-sensitive work additionally requires a comparable
benchmark and, before installation acceptance, a physical target-device result.
Desktop measurements must remain labelled as desktop evidence.
