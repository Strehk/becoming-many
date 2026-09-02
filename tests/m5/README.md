<!--
Purpose: Explain the M5 test scope.
Context: The polling adapter must honor the ControlFrame contract without hardware.
Responsibility: Route tests for the wire parser and the pure control pipeline under src/m5.
Boundary: The network poller and the flight application are verified by running them.
-->

# M5 Tests

This folder verifies the untrusted `/state` parser and the pure control
pipeline: safety flattening, rest-pose auto-neutralize (with injected
timestamps — no test sleeps), smoothing, and the control source's counter-diff
button edges, consume-on-read latching, staleness, and wrong-device rejection.
