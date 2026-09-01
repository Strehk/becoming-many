<!--
Purpose: Explain what is verified about the station transport.
Context: Both pages act on messages arriving from a socket they do not control.
Responsibility: Route station tests and say what they deliberately leave out.
Boundary: The implementation lives in ../../src/station and ../../station.
-->

# Station tests

`station-protocol.test.ts` verifies the wire contract: every message kind
survives a round trip, and anything malformed is refused rather than thrown.
That refusal is the point — a parse error inside a socket handler has nobody to
catch it, so `parseStationMessage` answers `undefined` instead.

The socket client and the broker are not tested here. Both are bound to a live
WebSocket, which is the same line `tests/dramaturgy/README.md` draws around the
narration player: the pure half is extracted so it can be measured, and the
half that owns a connection is exercised by running it.
