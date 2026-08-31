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

`world-surface/` verifies deterministic surface facts. `control/` verifies
input-independent navigation constraints. `levels/` verifies preset boundaries.
`modules/` verifies concrete resource owners. `world/` verifies shared execution
infrastructure.
