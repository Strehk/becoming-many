# Required flight tutorial — 2026-09-08

The spatial tutorial replaces the held-gesture Start MVP on its existing routes
and opens the full experience. The approved sequence is right → left → up → down,
without a deadline. Actual ring passages advance learning; missed goals remain
active with direction guidance. Show holds transport, language and completion
policy; Run retires training and releases the prepared main experience only after
the operator selects **Begin experience**. World, M5 and locomotion retain their
existing ownership. No second renderer, render loop or show clock was added.

Implementation checkpoint: `1818a88155e6d0b82e2168171e8e67e4d2b765e6`.
The subsequent review correction prepares recreated GPU resources before reset
becomes ready, and retains preloaded main narration across the tutorial handoff.
[Performance](../../performance.md#flight-tutorial--2026-09-08) owns measurements
and their limits; [current status](../../current-status.md) owns current readiness.

## Browser evidence

![Formed right-hand ring and near-field direction arrow](formed-goal.png)

Standalone Start, 1280 × 720, headed Chromium on Apple M2 Max. The final 80-degree
desktop projection keeps the first ring visible below the existing assisted head
pitch. Capture from the implementation checkpoint before the preparation-only
review correction. The ring and arrow use the same fixed particle allocation.
This is a desktop view, not a headset readability or comfort assessment.

The retained functional suite passes seven combined scenarios (Root, Conductor,
Start, startup failures and UI-mount failures), plus four shared-UI scenarios
(Echo and Flash including their failure paths). Root and Conductor traverse all
four spatial goals through the actual M5 polling, validation and smoothing path
using simulated firmware responses. Existing main-show language, playback,
seeking, scrubbing, responsive layout and cleanup assertions remain enabled.
Exact source digests and scratch report paths are retained in current status.
After the review correction, a fresh root smoke passes 3/3 scenarios, including
all course passages, handoff, main-language/transport interaction and declared
startup/mount failures. Ten focused regression tests, build and mandatory lint
pass. Fallow 3.23 remains fail with ten introduced complexity and four CSS
findings; dead-code, import-boundary and cycle counts remain zero.

The additional review comparison exercises two complete courses, handoffs and
Conductor Stop resets per build. It uses the actual controls and the existing
course fixture, without editing scene/camera/progress state. GPU/RAF diagnostics
are separated from the earlier functional smoke; screenshot intervals are
excluded from the timing groups. Essential results and raw-report hashes are in
[the measurement summary](summary.json).

![Main experience after all four passages and operator handoff](operator-handoff.png)

Conductor after the completed course and **Begin experience**, then paused for
capture. Main chapters are available again. This image records the review
candidate at 1920 × 1080; the embedded rendering canvas is 934 × 525.

![Held orientation after Stop recreates training](held-restart.png)

The same Run after **Stop**: training is back at right, 1/4; Play is available
and main chapters are disabled. The cloudy arrival presentation is expected
before formation begins. No page reload or replacement renderer occurs.

## Independent performance review

A separate read-only reviewer examined `1818a88`, its frame/resource ownership
and the recorded measurements. It confirmed fixed particle buffers, bounded
grain/source settings, no per-frame particle/wake allocations, and source/context
cleanup. It found:

- **P2, corrected:** post-handoff reset recreated GPU resources without preparing
  them. World now shares only in-flight preparation, holds visible frames while
  sampling its existing timer, warms new resources offscreen, and restores XR,
  target and visibility. Run's readiness gate also waits when audio is absent.
  Deferred preparation, failure/retry and cancellation have focused tests. The
  independent reviewer re-read the correction and found no remaining defect in
  these paths.
- **P2, evidence extended:** the quick replay measured only goal 0 in its flying
  phase. Its numbers are animation timestamp intervals with VSync disabled,
  not isolated CPU or GPU durations. The new full-course diagnostic includes
  passages, dissolution, subsequent goals, handoff and recreated training.
- **P3, claim narrowed:** zero sparkle/glow values do not remove their shader
  calculations. The comparison establishes equal resources, not zero marginal
  GPU cost. No extra shader variant was introduced for this claim.
- **Preparation risk addressed:** main narration used to be created only at
  handoff. Its existing owner now preloads it during training and releases only
  tutorial-exclusive clips on handoff. This preserves one bounded media owner. As before, media preload is started
  early; readiness of every HTML media element is not awaited.

## Acceptance and limits

#109's fixed cloud and drift implementation is closed. #110/#113 spatial passage,
formation, dissolution and wake are implemented and locally exercised. #111/#112
have bounded spatial-audio and narration integration, but production content and
listening acceptance remain open. #50 therefore remains open.

The five German recordings were found in the
[predecessor's pinned audio directory](https://github.com/E-Mus/becoming-many-tutorial/tree/52fdfdb69a80b63988b71e035614db8abad4bac1/public/audio).
No English recordings or effect samples were found there. Production Start
currently has no narration/audio recipe while the specific DE-use, EN behavior
and sample decisions remain pending. Synthetic audio probes establish routing
and cleanup only; they are not production listening evidence.

Automated desktop pointer lock still fails under #83; simulated M5 success does
not resolve it. Fallow retains its recorded complexity/style findings without
suppressions. No new full 521-second observation, complete combined production
audio/render measurement, human tutorial-comprehension test or Windows-PCVR
USB-C 90 Hz/transport/headset acceptance is claimed. These limits prevent calling
the required production tutorial fully accepted.
