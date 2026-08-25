# Session and Operator

## Session state machine

The exhibition flow is an explicit state machine, owned by the app and mirrored
to the operator page. Its integration point in the runtime is
[Open Decision 2](open-decisions.md).

```text
idle ──staff: arm──► boarding ──staff: tutorial──► tutorial ──staff: start──► piece
 ▲                   (see-through,                (scripted                 (schedule
 │                    visitor on rig)              mini-course)              runs)
 └──staff: reset──── return ◄──schedule end / staff: safety-exit ────────────┘
                     (fade to white → see-through)
```

- **Staff arm and start every phase.** The M5 button is an input *within*
  phases (e.g. confirming in the tutorial), never the session trigger.
- **Safety exit is available from every state** and always does the same
  thing: fade the world to white, return the headset to see-through, keep
  audio calm.
- **Missing acknowledgement = do not advance.** Every phase button gates on
  confirmed state (headset / streaming / M5 as applicable); a stale connection
  or missing acknowledgement blocks the transition with an operator-visible
  reason. Staff can override explicitly — never silently.
- Language (DE/EN) is fixed at `arm` time for the whole session.

## Operator page

Runs on the second monitor of the station PC. Scope is deliberately narrow:
**session control, status monitoring, live visitor view** — not a
timeline or sense-override surface (that is a dev/rehearsal concern).

- **Session control**: the state-machine buttons, language toggle, volume.
- **Monitoring**: M5 connected / last-frame age / calibration (+ wrong-device
  warning), app FPS summary, headset battery + worn state + streaming status
  ([Headset](headset.md)), audio state. One glance answers "is everything OK".
- **Live visitor view**: the app mirrors its rendered frame — same machine, so
  a scaled-down copy at reduced rate is enough; no headset API involved.
- Transport: a small localhost station server brokers messages; the experience
  page and operator page each hold one WebSocket to it.
