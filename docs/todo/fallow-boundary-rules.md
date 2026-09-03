<!--
Purpose: Track the absence of executable architecture boundaries in Fallow configuration.
Context: Fallow reports zero violations but no project zones are configured.
Responsibility: Turn the documented module rules into a small automated gate.
Boundary: This does not model every folder or replace architectural review.
-->

# Configure Fallow Architecture Boundaries

**Status:** Open
**Priority:** Tooling integrity
**Issue:** [#11](https://github.com/Strehk/becoming-many/issues/11)
**Depends on:** [#34](https://github.com/Strehk/becoming-many/issues/34), Step 2

## Problem

Fallow reports zero boundary violations, but `.fallowrc.jsonc` currently only
records two narrow analyzer exceptions: the intentional `level` export and the
verified `@material/web` compatibility override. It defines no architecture
zones. Zero violations can therefore be mistaken for proof that module
boundaries are enforced when they are not configured.

## Affected Files

- `.fallowrc.jsonc`
- `src/modules/`
- `src/world/`
- `src/levels/`
- `src/control/`
- `src/vr/`
- `src/test/`
- `src/conductor/`
- `src/control-wire/`
- `docs/engineering-standards.md`

## Smallest YAGNI Solution

Add only the documented high-value rules:

- modules cannot import concrete sibling folders;
- world cannot import levels or concrete modules;
- presets cannot import runtime implementations;
- shared Experience code cannot import VR, Test, or Conductor entries;
- VR cannot import Test or Conductor UI;
- Conductor cannot import VR, Test, levels, world, render code, or Three.js;
- shared runtime cannot import back into Test.

Do not model every directory or add a second dependency analyzer.

Apply the preset/runtime rule only after issue #34 extracts `LevelPreset` and
`TerrainPreset` into the data-owned `level-preset.ts`. Enabling that rule first
would intentionally fail every current preset because the contract still lives
in `level-runtime.ts`; a permanently red gate would not prove architectural
integrity.

## Verification

Prove each rule with one temporary failing fixture or analyzer test, then remove
the fixture and run Fallow on the real tree.
