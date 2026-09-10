# Current Work

This file is a resume pointer, not a roadmap. Issue bodies and milestones own
scope, dependencies, acceptance criteria, and results.

## Development checkpoint

- Branch: `david_refactor` only. Completed, verified blocks are committed and
  pushed to `origin/david_refactor`; `main` and additional branches are out of
  scope.
- Checkpoint before clearing the Start level: `296e6be`.
- Active architecture work: [#118](https://github.com/Strehk/becoming-many/issues/118),
  [#119](https://github.com/Strehk/becoming-many/issues/119),
  [#121](https://github.com/Strehk/becoming-many/issues/121), and
  [#123](https://github.com/Strehk/becoming-many/issues/123), coordinated by
  [#76](https://github.com/Strehk/becoming-many/issues/76).
- Start is reduced to its standalone Air Particles environment. The previous
  tutorial runtime, audio playback, UI state, and Show handoff are removed.
  The full Show begins directly with its authored main schedule.

## Deliberately separate work

- The calm transition in #122 Stage B, particle representation work in #124
  Stage B, and physical guidance correction in #117 are later behavior changes.
- The new Start-level product concept and its visual references are maintained
  by their dedicated planning task. Do not fold them into architecture cleanup.
- Installation commissioning and handover remain in #42, #54, and #116;
  visitor replacement and calibration remain in #9, #46, and #33.
- The exact deterministic benchmark reference remains unapproved under #78.

Resume by reading the active issue, then [Architecture](architecture.md) and
[Development](development.md). Do not replay historical documentation.
