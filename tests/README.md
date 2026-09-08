<!--
Purpose: Explain the top-level test organization.
Context: Production source and verification code have separate ownership roots.
Responsibility: Route tests to the subsystem they verify.
Boundary: Runtime implementation remains under ../src.
-->

# Tests

This top-level folder contains automated verification code. Tests mirror the
production ownership structure without placing test files inside `src`.

Use one focused subfolder per production area. Import the real implementation
from `../src`; do not duplicate production helpers inside tests.

`benchmark/` verifies the pure route and report logic and holds the browser
benchmark runner, which `bun test` ignores because it is not a test file.

`dramaturgy/` verifies show time and cue lookup, both pure; the narration
player is DOM-bound and is not tested here.

`sound/` verifies what the drone organ decides before it touches an audio
graph — the composed piece against the sense ladder, the patch chain, and the
placement lookup; the graph itself needs a browser.

`station/` verifies the deployment-config contract; the server is
connection-bound and is not tested here. `conductor/` verifies what the
operator page decides before it touches the DOM — the key map, the operator
actions, the stream button's label, and the readouts.

`world-surface/` verifies deterministic surface facts. `control/` verifies
input-independent navigation constraints. `levels/` verifies preset boundaries.
`modules/` verifies concrete resource owners. `world/` verifies shared execution
infrastructure.
