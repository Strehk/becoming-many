# Dramaturgy and Audio

## Schedule

- The runtime plays **plain baked schedule data**: per-sense intensity
  envelopes (keyframed 0..1 curves), narration cue times, and audio gains —
  against one virtual clock with pause/seek/timeScale, so scrubbing and
  rehearsal work. Schedules are committed as typed TypeScript data files, per
  the repository's configuration rule — no JSON schedule format.
- There are two schedules: the **tutorial** (a short scripted mini-course
  confirming the visitor can steer) and the **piece** (roughly five minutes:
  discovery → realisation → overload → return).
- Authoring loop: tune in the browser → export the baked schedule as a typed
  TypeScript data file → commit. Any curve-editor tool is **dev-only and
  exports baked data** — never a runtime dependency, never a second schedule
  authority.
- One schedule authority total. How clock and schedule integrate with the Level
  Runtime is [Open Decision 2](open-decisions.md).

## Language

- **Language is a session parameter (DE/EN)**, fixed when staff arm a session.
  The operator page is where staff set it. It can be re-armed while the piece is
  loaded, which pauses the show and re-seats the narration at the same instant;
  that is a rehearsal affordance, not something done under a visitor.
- `script/de.md` and `script/en.md` are both shippable content; narration
  assets are addressed as `narration/<lang>/<cueId>`. Cue *times* are shared —
  only audio files (and audience-facing copy) switch.

## Audio

- Audio plays in the headset.
- Every sense has a sonic counterpart faded by the sense's intensity signal —
  the accumulation is heard as much as seen.
- The **drone-organ synth** integrates as a sound engine without its UI: the
  Tone.js patch graph driven by schedule envelopes and sense intensities like
  every other audio layer. Its patch-cable UI stays in its old repository.
- Everything audio is slaved to the clock so seek and pause behave in
  rehearsal.
