# Session handoff — 2026-09-09

This dated handoff closes a day of phone-based feedback and remote development.
Source reviewed: `david_refactor` at `226038da8b649681ec39e6285fd0e5fc968267fa`.
The final closeout changes documentation/issues only. The [roadmap](../roadmap.md)
remains the next-work authority; this is not a second implementation plan.

## Outcome reported by the user

The installation now runs using the **front USB port**. The **rear USB-C port
next to Ethernet must not be used**: inserting a cable reportedly shuts down
the PC and provides no headset signal. The [deployment instructions](../direction/deployment.md#verified-cabling-restriction--office-report-2026-09-09)
are the canonical cabling/recovery reference. The precise hardware cause and
per-station inventory remain unknown; do not reproduce the shutdown for routine
diagnostics or attribute it to a particular USB standard without evidence.

The tutorial is still not usable as intended: the user cannot follow arrows
because there is insufficient turning lead, and white space makes the actual
flight direction hard to understand. [#117](https://github.com/Strehk/becoming-many/issues/117)
records this under #50. A curve/direction indicator is a candidate to evaluate,
not a selected HUD or an approved new subsystem. No tutorial implementation was
requested in this final documentation block.

## What changed during the session

| Change group | Commit anchors | Current review entry points |
| --- | --- | --- |
| Required spatial tutorial replaced the held-gesture/opaque-arrow MVP; shared Show/Run, four goals, misses/recycling, timeline and timed handoff | `1818a88`, `4480d55`, `ffc495b` | `src/levels/show.runtime.ts`, `src/levels/level.runtime.ts`, `src/modules/start/start.module.ts`, `src/levels/start.level.ts` |
| World anchoring, dense chunks/clouds, captured-view cues, actual-turn gating, speech markers, rig-motion prediction and independently persistent arrows | `a704fa8`, `438f345`, `4f81475`, `6a64d76`, `4bb726a`, `36e33c2`, `315d89e`, `db79b30` | Start module/effect/shaders; `src/world/viewer-rig.ts`; [scene script](../direction/tutorial-scene-script.md) |
| Eleven supplied instrumentals archived; bounded granular object voices, quiet wind/passage effects, distance/reverb and softer release | `551b441`, `473a725`, `4bacaec`, `6f38f28`, `f54293e` | `src/sound/training-audio.runtime.ts`, `public/audio/granular/`, tutorial effect provenance |
| Shared tutorial overlay, captured-view arrow facing, full native speech and breathing interval; independent audit repaired language-after-handoff, wind-reset and cold seek faults | `da3a986`, `203ab51`, `ff9e8a2`, `c4555cd` | Show, `src/sound/narration-player.ts`, shared `src/ui/`; [tutorial evidence](issue-50/README.md) |
| User's Windows branch deployment preserved, including stopped-Watchdog deployment and reboot selection | `85e154c`, `a1ab93f`, merge `78dd8b0`, synchronization `e52dee4` | `scripts/deploy-*`, `scripts/station-deployment.ps1`, `watchdog/bin/docker-up.bat` |
| Controller State in technician drawer, removed Begin experience button, desktop XR eye copy | `ad2f8ec` | `src/ui/conductor/technician-drawer.panel.ts`, `src/world/xr-mirror.ts`, `src/world/world-runtime.ts` |
| User-requested permissive M5 acceptance, selected by configured host | `621c1e3`, `57fe2d5` | `src/m5/runtime/control-source.ts`, parser/host lifetime; obsolete `control-safety.ts` removed |
| Windows startup diagnostics, correction of mistaken runtime advice, independent component starts and manual reversible TCP repair | `d135d32`, `093f40f`, `226038d` | `scripts/start-station.ps1`, `find-problems.ps1`, `repair-pico-port.ps1`, BAT launchers |

All work stayed on `david_refactor`. Main was read as historical evidence;
its old owners were not a target architecture. Preserve the user's deployment
contributions rather than resetting to a pre-tutorial checkpoint.

## Corrections that must survive the handoff

- **German narration:** the user retracted the claim that German was missing.
  The five original German tutorial recordings are installed. EN deliberately
  uses those same clips temporarily; replacement English recordings are still
  required. Do not describe EN as translated narration or restore the older
  claim that temporary German use is unapproved.
- **Timing/UI:** 60 playing seconds limits learning, not native speech. Current
  speech or the earned closing finishes, then 1.5 playing seconds of breathing
  space; the bounded four-second sound drain can overlap main. Roughly 74 seconds
  is not a hard cutoff. Keep the shared transport; the separate Begin experience
  button was explicitly removed. Earlier screenshots and descriptions of that
  button, simultaneous rings/arrows or older particle counts are historical.
- **PICO mode:** requiring SteamVR mode just because the app uses WebXR or a
  SteamVR Watchdog exists was incorrect advice. The user's prior setting was
  OpenXR Streaming; switching did not fix the bind error and added a registry
  warning. Exact working native runtime/PICO settings still need inventory.
  No automatic vendor mode change or reinstall was implemented.
- **Diagnostics export:** the documented export control was not visible in the
  user's PICO 2.1.2 General page. Do not keep directing the operator to it; the
  project now has a double-click local report.
- **Separate real faults:** EventLog owned TCP 49667 (PID 3672, later 3728).
  The first guarded startup in `d135d32` introduced an additional global abort
  that skipped independent station/kiosk starts. `226038d` fixes that regression.
  The rear USB shutdown is another reported failure; neither erases the others.
- **Causality:** a second, reportedly not user-updated station also failed.
  Repository updates alone are not established as the cause of vendor binding
  or hardware shutdown. No automatic update or shared-network cause is proven.
- **Readiness:** HTTP 200, a running process, a port listener or WebXR presenting
  state alone never proved headset delivery. The later user statement now
  establishes reported operation; it does not certify every acceptance scenario.

## Windows state outside Git

The post-repair photo from checkout `226038d` shows IPv4/IPv6 dynamic TCP ranges
`50000–65535`, no TCP listener on 49667 and station HTTP 200. Watchdog UDP endpoints
were absent in that capture. The later working-installation report did not supply
fresh diagnostics, an active container revision or a complete two-station result.

The manual administrator repair changes host TCP allocation, not Docker or
application configuration. It leaves 15,536 ports (848 fewer than the default),
keeps a machine-bound original backup at `watchdog/run/pico-port-backup.clixml`
and offers `-Restore`. Do not delete/copy that backup between PCs or rerun repair
as routine startup. No EventLog killing, UDP/firewall/exclusion/registry mutation,
second supervisor or browser-to-host execution bridge was introduced. Normal
startup only diagnoses and starts existing independent components.

Git pull alone does not apply or undo host network settings. The existing branch
deployer intentionally rejects protected infrastructure differences; a clean
explicit fast-forward is needed before deploying such updates. Its checks must
not be bypassed, and local `.env`/image selection must be preserved. See the
[deployment document](../direction/deployment.md) and #116 for exact operation.

## Review focus for the next desktop session

The user requests a direct code review before more feature work after a day
without inspecting the codebase. The read-only fresh-context review found these
concrete review targets; it did not certify the entire architecture:

1. Read the Start recipe and actual cue placement together. Current authored
   distances are 8–9 m, arrow length 6 m and flight speed 2 m/s; captured-FOV and
   minimum-distance calculations also alter placement. Do not assume one number
   explains the failed human turn. Distinguish look, travel forecast and proposed
   guidance; visible anchors must never follow head motion.
2. Review Show/Run and Start growth for one time authority, bounded local states,
   reset/cancellation, arrow-versus-ring lifetimes and actual crossing facts.
   No automatic steering or extra input/render owner is allowed.
3. Review training audio's borrowed contexts, fixed source pool, source fades and
   draining lifetime through pause/reset/handoff. Confirm speech is not truncated
   and exclusive resources really end after tails. Keep native narration distinct
   from granular sounds and the existing organ.
4. Review World's XR framebuffer copy/state restoration against actual Windows
   projection-layer behavior and cost. It copies an existing rendered eye, not a
   second scene render/loop. Desktop mocks do not prove the installation mirror.
5. Review permissive M5 parsing at its existing owner. Firmware/identity,
   calibration, sequence and extreme-pose eligibility gates were removed by user
   decision; parsing/freshness/host invalidation and input smoothing remain.
   Distinct configured host/IP values bind the two stations; IDs are diagnostic,
   not an automatic routing or wrong-device rejection guarantee.
6. Review host startup failure isolation and the manual OS repair separately
   from browser Engine ownership. Preserve user deployment/rollback behavior;
   verify actual Watchdog version/startup entries without restoring legacy copies.

Track this requested review in #76; concrete tutorial correction is #117/#50,
installation inventory is #54 and remaining startup acceptance is #116. This
one-time review request adds no permanent framework or recurring review gate.

## Verification and remaining acceptance

Existing dated [tutorial evidence](issue-50/README.md) records real browser
screenshots, focused tests and measurements, including failed/clipped silhouettes.
Simulated M5 courses reached four targets; this did not predict human usability.
The office feedback supersedes any implication of full tutorial acceptance.
Do not erase failed evidence or call local particle-density approval 90 Hz proof.

For `226038d`, recorded checks passed: mandatory lint, diff check and the existing
PowerShell startup, diagnostics, deployment and new 13-scenario port-repair tests.
They ran on macOS PowerShell 7.6.6 with Windows/native boundaries mocked; deployment
used temporary Git repositories. The user's subsequent Windows photo verifies the
TCP range result, but not every branch of UAC, rollback or startup behavior.

Still open: both-station port/headset/M5 inventory and labelling, cold boot and
supervision, USB reconnect through the permitted front port, controller polarity,
XR desktop preview, natural speech/mix listening, new-visitor comprehension,
full visitor replacement/calibration (#9/#46), replacement EN audio and actual
Windows-PCVR 90 Hz. Existing #73 clock evidence and #78 unapproved benchmark
reference remain unchanged. Do not close #50/#54/#116 on this handoff alone.

The documentation-only closeout passed `bun run lint` (340 files),
`git diff --check` and local Markdown target checks. No application build,
browser replay or physical test was repeated for unchanged runtime code.
