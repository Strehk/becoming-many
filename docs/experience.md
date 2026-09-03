# Experience

## Implemented Piece

**Becoming Many** is one continuous flight through a procedurally streamed
world. The visitor retains their position while sensory layers appear around
them. World states are authored levels, but the running show composes their
union once and transitions through intensities rather than loading separate
scenes.

The current typed schedule lasts 8 minutes 41 seconds:

| Time | World state | Perceptual focus |
| ---: | --- | --- |
| 0:00 | White World | silent lead-in and openness |
| 0:05 | White World | prologue |
| 1:22 | Scent | chemical traces and sources |
| 2:14 | Echolocation | depth reveals the solid world |
| 2:47 | Motion | moving signals and trails |
| 3:50 | Thermal | false-colour heat relationships |
| 4:39 | Magnetic | directional sky perception |
| 5:35 | Connections | the layered network synthesis |
| 7:26 | White World | return |
| 8:36 | White World | end credits |

Cue timings are authored in `src/dramaturgy/piece-schedule.ts`; narration text
is authoritative in `script/en.md` and `script/de.md`.

## Presentation Flow

The default page starts the complete show and waits for a user gesture when the
browser has suspended audio. The rehearsal transport can hold, seek, or jump.
The conductor page provides the same show in an operator-facing station window,
with transport, language, reset, headset entry, controller setup, and technical
status.

Passthrough onboarding/offboarding and an explicit installation session state
machine are product direction, not current runtime behavior. Their decisions
remain in [direction](direction/README.md).

## Visual Layers

- White World establishes fog, background, and air.
- Scent adds bounded particles emitted from deterministic plants and animals.
- Echolocation reveals terrain, vegetation, rocks, and distance colour, and
  introduces the narrative Grass Clipmap.
- Motion adds point actors and persistent movement trails.
- Thermal applies a local false-colour view to solid surfaces and animals.
- Magnetic adds a directional sky dome without recolouring the ground.
- Connections reveals a pulsing network between world anchors.

The finale layers these signals deliberately. The return removes them until the
visitor reaches White World again, where the end credits fade in over the last
German lines and hold until the experience is restarted.

## Input and Audio

Desktop development uses pointer-lock look and keyboard flight. WebXR tracking
provides local head pose while the same viewer rig receives flight movement.
The M5 adapter maps physical tilt and button state into that flight boundary.

English and German narration share one typed schedule and one audio timebase.
The audio timebase is show-time authority; if audio is suspended, show time does
not silently advance. Additional spatial sound design remains possible as a
small issue-backed product addition, but it must stay synchronized and bounded.
