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
- Language (DE/EN) is fixed at `arm` time for the whole session. The operator
  page holds that control; re-arming it mid-piece is a rehearsal affordance,
  and it pauses the show rather than switching under a visitor.

## Operator page

Runs on the second monitor of the station PC at `/conductor.html`, beside a show
window opened at `/?show&station`. Scope is **session control, show transport,
status monitoring, live visitor view** — but not a sense-override surface, which
stays a dev concern.

The show transport was originally scoped out of this page as rehearsal-only.
It is in: a person conducts the piece live, and holding, jumping to a section,
and recovering a lost cue are exactly what conducting means. Building it once,
here, avoids a second operator surface that would have to be kept in step.

- **Show transport** *(built)*: one scrubbable timeline of the narration
  schedule, play and hold, time scale, jump to any cue, a next-cue countdown,
  and resets for the show clock and the flight. Each cue draws as its slot with
  its recording inside it, so overrun and dead air are visible per language
  while cue times are being tuned. See [`src/conductor`](../../src/conductor/README.md).
- **Session control** *(not built)*: the state-machine buttons, volume.
- **Monitoring**: M5 connected / last-frame age / calibration (+ wrong-device
  warning), app FPS summary, headset battery + worn state + streaming status
  ([Headset](headset.md)), audio state. One glance answers "is everything OK".
- **Live visitor view**: the app mirrors its rendered frame — same machine, so
  a scaled-down copy at reduced rate is enough; no headset API involved.
- Transport *(built)*: a small localhost station server brokers messages; the
  experience page and operator page each hold one WebSocket to it. Started with
  `bun run station`; see [`station/`](../../station/README.md) and
  [`src/station`](../../src/station/README.md). The broker relays only — it
  holds no show state, and the show plays normally when it is not running.
