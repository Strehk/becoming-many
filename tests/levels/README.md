<!--
Purpose: Document verification ownership for level presets and public Run contracts.
Context: Sparse level data must preserve narrative and development boundaries.
Responsibility: Route preset, capability and Run lifetime tests.
Boundary: Runtime module behavior belongs in ../modules.
-->

# Level Tests

Preset tests verify authored level boundaries and catalog resolution.
`ui-boundary.test.ts` checks narrow public UI capabilities, required Run inputs
and language access independent of main Show availability.

`tutorial-restart.test.ts` runs the real Run owner with injected leaf fixtures.
It covers restart across tutorial/main/transition states, coalesced requests,
failure/retry and pending cleanup. Language checks use the public Run command
and verify playback, position and composition identity are preserved. Browser
tests supply real rendering, media and complete tutorial interaction under the
[verification guide](../browser/README.md#live-language-regression).
