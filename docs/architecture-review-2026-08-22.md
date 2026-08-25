# Architecture review — 2026-08-22

Critical review of `architecture.md` (DRAFT v2, decisions of 2026-08-21). Line references
point into that revision. Overall verdict: the core decisions — topology, localhost/plain-WS
collapse, switching XR model, clipmap/additive-density world model — are well-argued and
evidenced. The findings below are mostly promises the document makes that nothing in it
delivers, plus a few internal inconsistencies. Ranked by impact.

Status: **open** — none of these have been addressed in `architecture.md` yet.

## Major findings

### 1. "One protocol module" cannot be one module across three languages
`shared/protocol/` (§9) is TS, but the firmware is C++ and the headset agent is an Android
app — two of the three consumers cannot import it, so field names get hand-mirrored in three
languages: structurally the same failure as the old version string that "lived in three
repos and was checked in none." §12's claim that CI *building* firmware + APK prevents drift
is wrong — building proves nothing about wire compatibility. Needs an explicit mechanism:
schema-driven codegen into each language, or golden frame fixtures parsed by all three test
suites. The doc should name which.

### 2. No recovery/supervision story for the station PC itself
The M5 and the headset both have provisioning and return-to-known-state stories; Chrome on
the station PC — the process that renders the piece — has none: no auto-start on boot, no
crash/hang supervision, no WebGPU device-loss handling, no Chrome auto-update pinning, no
Windows-update policy. Concrete gotcha: `navigator.xr.requestSession` requires user
activation; operator-page buttons brokered over WebSocket cannot grant it, so after any
crash/restart someone must physically click the experience page. §10 needs a "station PC
supervision" subsection with the same seriousness §10.4 gives the headset.

### 3. The crash-isolation promise has no mechanism
Principle 2 promises a sense can be "crashed without taking the piece down," but the only
handled failure is `load()` rejection (§6). Nothing catches an exception from a registered
`tick()`, a compute pass, or a failed shader compile in `init()`, or quarantines a layer
mid-piece. The single loop makes this *worse* than bm-base's four rAF chains, where a
crashed chain only killed itself. Needs a defined error boundary in the frame loop:
catch → log → deregister the system → zero its signal.

### 4. §12 asserts CI gates that cannot run on hosted CI
(a) The CPU/GPU height-agreement readback test needs a working WebGPU context — GPU-capable
runners or a headless fallback, neither mentioned. (b) The `station` perf profile ("actual
PC spec, 90 Hz stereo + streaming encode headroom") is inherently machine-bound; a hosted
runner can measure neither stereo nor encoder contention, and "no machine-specific paths"
is in direct tension with a profile defined *by* a machine. Split the gates explicitly into
three tiers: hosted CI / station-attached runner / manual acceptance protocol.

### 5. Two-stations-one-network cross-talk solved only for the M5
§9 binds M5 ↔ station well. Unaddressed on the same LAN: PICO Business Streaming pairing
(can headset A pair with PC B? what pins it?), and how the headset agent discovers *its*
station server among two. State the deviceId-binding discipline once as a station-wide rule
covering all three device relationships.

### 6. Device discovery is underspecified in a way browsers cannot paper over
"The device announces itself via mDNS/UDP beacon" — but the WS clients are browser pages,
which can neither browse mDNS nor listen to UDP. The station server must listen and hand
the M5's address to the pages; that arrow is missing from §9/§10.2, and it quietly makes
the station server a hard dependency for M5 connectivity, which changes the
"works-in-any-state" analysis.

## Moderate findings

### 7. The tutorial breaks the schedule model
The schedule player is "THE single dramaturgy authority" playing time-keyed envelopes, but
the tutorial is completion-gated ("confirming the visitor can steer") — wait-until-success
is inexpressible in a time-based schedule. Either the schedule contract grows
hold-points/conditional advancement, or the tutorial is really session-state logic and only
cosmetically a schedule. The contract question shapes `core/schedule` (Phase 1) and cannot
wait for Phase 4.

### 8. Audio may have no path exactly when "keep audio calm" is promised
Safety-exit commands see-through; in the agent model that means backgrounding the streaming
client — which *is* the audio path ("audio plays in the headset, carried by the stream").
If audio dies with the foreground, safety-exit is silent and boarding can carry no
ambience. Add "does audio survive the client being backgrounded?" to SPIKE P1's checklist.

### 9. Perf budgets are not pinned to the designed worst case
Overload is deliberately "every sense at once," yet §11/§12 never state which scene the
Playwright harness measures. The budget scene must be Overload at full intensity plus
narration plus encode load — otherwise the gate is green while the climax drops frames.

### 10. Asset loading has no timing story
`load()` exists per sense but nothing says when it runs (boot? arm?) or whether
`boarding → tutorial` gates on all senses and both narration languages being resident.
Obvious installation rule: everything preloaded before a visitor is on the rig, `arm`
blocked until then — belongs in §10.1's acknowledgement-gating list.

### 11. §2 "(decided)" rests on §14.6 "unconfirmed"
§2 flatly states PICO 4 Enterprise ("its enterprise OS matters") while §14.6 admits the
edition is unconfirmed and the only hardware evidence is a PICO 4 **Ultra** Enterprise. §2
should cross-reference §14.6; as written, a reader of §2 alone leaves more certain than the
document actually is.

## Minor / editorial

- **Stale count:** §3 says "the three experiments are raw GLSL/WebGL2" but principle 3
  correctly says "all four rendering experiments" — `magnetic-sense-webxr` was integrated
  later and §3 was not updated (it too needs the TSL port per the extraction map).
- **SenseLayer interface nit:** `intensity` — the most important part of the contract —
  exists only as a comment; the interface never shows how the signal binds. Show the field.
- **M5 as WS server:** the Plus2 has no PSRAM; three-plus browser clients on an ESP32 WS
  server needs a client cap and a slow-client eviction policy, or one wedged subscriber
  stalls the broadcast.
- **Line-wrap artifact** in the status header ("and the / Futurium…") from the v2 edit.
- **Phase ordering risk:** rig-profile calibration on the real ICAROS is Phase 5, but
  tutorial design (Phase 4) depends on real steering feel. Pull one calibration session
  forward or note the dependency in §13.
- **Missing entirely: operational logging.** Only the setup page has a (redacting) log.
  Nothing records sessions, errors, or perf history on the station for post-mortems after
  "it glitched yesterday afternoon" reports — the most common museum bug report there is.

## Cross-cutting observation

The document is excellent at *decisions* and thin on *failure mechanics* — who catches, who
restarts, who supervises. A single section on failure handling and supervision would close
most of findings 2, 3, and 6 at once.
