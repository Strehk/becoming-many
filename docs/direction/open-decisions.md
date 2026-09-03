# Open Decisions

These choices require discussion or physical evidence before implementation
commits to a path. Current code and engineering standards remain authoritative
until a decision is recorded here and in the affected canonical documents.

## 1. Final Delivery Platform

Choose between standalone PICO WebXR and wired Windows PCVR only after both
relevant paths have been tested on the intended hardware matrix.

Acceptance evidence must cover complete-show frame timing, startup, tracking,
audio, M5 connectivity, repeated-session recovery, operator workflow, and—on
PCVR—render/encode/USB/decode latency. Wireless streaming is not the current
installation baseline.

Until decided, mobile-first PICO 4 performance rules remain the stricter design
constraint.

## 2. Passthrough and Session Flow

The Conductor and show clock are implemented; an installation session state
machine and passthrough onboarding/offboarding are not. Decide after the
delivery-platform test establishes which headset state changes can be commanded
and confirmed.

The smallest candidate is a local Conductor-owned phase model around boarding,
active show, return, and safety exit. Do not introduce a global event bus,
service locator, remote operator service, or second schedule authority.

## 3. Additional Installation Runtimes

Browser source, Bun station server, M5 firmware, and the flash page have stable
homes. An Android headset agent or technician CLI remains unapproved.

Add either only when a tested installation requirement cannot be met by the
current runtime and normal device tooling. Split new code by runtime boundary,
keep its protocol narrow, and record how it degrades when unavailable.

## 4. Provenance of the Carried-Over Models

The models carried over from `Strehk/uni-becoming-many` — the flock bird today,
the passage bird and bat on the branch that stages them — arrive with no author
and no licence recorded, and their manifests say so in place of a claim. Every
other asset in `public/` names Quaternius and CC0-1.0.

Decide before release, not before use: name the author and licence of each
carried-over file in its manifest, or replace the file. An installation that
shows a model it cannot account for is the risk being tracked here.
