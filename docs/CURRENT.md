# Current Work

This file is a resume pointer, not a roadmap. Issue bodies and milestones own
scope, dependencies, acceptance criteria, and results.

## Development checkpoint

- Branch: `david_refactor` only. Completed, verified blocks are committed and
  pushed to `origin/david_refactor`; `main` and additional branches are out of
  scope.
- Latest structural checkpoint: `400144b`.
- Active architecture work: [#118](https://github.com/Strehk/becoming-many/issues/118),
  [#119](https://github.com/Strehk/becoming-many/issues/119),
  [#121](https://github.com/Strehk/becoming-many/issues/121), and
  [#123](https://github.com/Strehk/becoming-many/issues/123), coordinated by
  [#76](https://github.com/Strehk/becoming-many/issues/76).
- The first Start structural pass establishes Start as the local learning hub,
  removes the separate practice runtime, injects motion constraints, narrows
  Show commands, and keeps one Run reset path.
- The pass is not a completed simplification: production source is net +281
  lines, Run is 632 lines, and Show is 762 lines against #119's 396-line target.
  ViewerRig is 87 lines. The 30/2/3 Start function limits pass.
- Verification at the checkpoint: 598 Bun tests, build, and lint pass. Browser
  functional assertions complete, while five pre-existing WAV request aborts
  keep the strict Rehearsal and Conductor runs red. Physical, listening, and
  Windows-PCVR acceptance remain open.

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
