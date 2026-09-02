<!--
Purpose: Explain what is verified about the station deployment contract.
Context: The pages act on config arriving from a server they do not control.
Responsibility: Route station tests and say what they deliberately leave out.
Boundary: The implementation lives in ../../src/station and ../../station.
-->

# Station tests

`deployment-config.test.ts` verifies the deployment-config contract: named
facts survive, blank or malformed values read as "not configured" rather than
as empty-string facts, and unknown keys are dropped.

The server itself is not tested here. It is an IO shell bound to a listening
socket, which is the same line `tests/dramaturgy/README.md` draws around the
narration player: the pure half is extracted so it can be measured, and the
half that owns a connection is exercised by running it.
