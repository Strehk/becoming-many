<!--
Purpose: Document ownership of the station transport layer.
Context: The show window and the conductor page run as two windows on one PC.
Responsibility: Explain what belongs in src/station.
Boundary: Show time lives in src/dramaturgy; the operator UI lives in src/conductor.
-->

# Station

This folder owns **the wire** between the two windows of a station, and nothing
else. It holds no show state, knows no schedule, and never decides what a
command means.

`station-protocol.ts` is the whole contract: a closed union of the commands the
conductor sends, the status the show reports, and the presence the broker
states. `parseStationMessage` treats every socket message as untrusted and
answers `undefined` rather than throwing inside a handler. It imports one type
from the dramaturgy catalogue — the DE/EN union — so the language crossing the
wire cannot drift from the language the narration ships in.

`station-link.ts` is the browser half: one socket per page, one retry timer,
typed send and receive. A send while disconnected is dropped rather than
queued, because a transport command that arrives late is worse than one that
never arrives.

`show-station.ts` is the show window's end: it applies arriving commands to the
running level (including `setM5Host`, which points the level's M5 adapter at a
device) and publishes status on a timer — with the M5 device state folded in,
so the conductor's strip can warn about a wrong or drifted controller. The timer matters — show time
derives from the audio clock, which keeps running when the window is unfocused
or occluded and its animation frames stop, so a status on a beat stays true
where a status per frame would simply stop arriving.

`station-widget.ts` is the show window's corner widget: the socket state the
link reports, and the way to the conductor page. It is an operator surface on
the desktop window — DOM never enters the `immersive-vr` view — and exists
because the link connects by itself on the default page: when no broker
answers, the widget is what says so.

`station-settings.ts` holds the port, the reporting rate, and the retry delay.

The broker itself is not here. It runs under Bun rather than in a browser, so
it lives at [`station/`](../../station/README.md) beside `tests/` and `script/`,
and imports this folder the way the benchmark runner imports `src/benchmark`.

## Not an event bus

The engineering standards forbid a global event bus, a service locator, and
hidden singletons. This is none of them: it is a cross-process transport with
one closed message union, one owner on each side, and no topics, registration,
or lookup. `docs/direction/deployment.md` prescribes exactly this shape — one
localhost broker, one socket per page. The in-process command bus that
[Open Decision 2](../../docs/direction/open-decisions.md) leaves rejected stays
rejected.
