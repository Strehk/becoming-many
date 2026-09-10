# Experience

**Becoming Many** is one continuous VR flight through a procedurally streamed
world. The visitor keeps their position while non-human perceptual layers appear
around them. The show prepares one composition and changes presentation rather
than loading a new scene at every cue.

## Narrative sequence

| Time | World state | Perceptual focus |
| ---: | --- | --- |
| 0:00 | White World | Openness and silent lead-in |
| 0:05 | White World | Prologue |
| 1:22 | Scent | Chemical traces and sources |
| 2:14 | Echolocation | Depth reveals the solid world |
| 2:47 | Motion | Moving signals and trails |
| 3:50 | Thermal | False-colour heat relationships |
| 4:39 | Magnetic | Directional sky perception |
| 5:35 | Connections | Layered network synthesis |
| 7:26 | White World | Return |
| 8:36 | White World | End credits |

The authored main show lasts 8:41. `src/dramaturgy/piece-schedule.ts` owns exact
timing. `script/en.md` and `script/de.md` own narration wording.

Senses accumulate rather than replace one another. White World supplies
atmosphere and air; Scent adds source traces; Echolocation reveals terrain and
vegetation; Motion adds actors and trails; Thermal changes local surface
perception; Magnetic adds a directional sky; Connections reveals the final
world network. The return removes those layers before the credits.

## Interaction

The complete experience begins directly with White World. The standalone Start
preset contains only airborne particles and shared flight controls. Its future
guidance, transition, visuals, and physical tests remain in the dedicated Start
concept and issues.

Desktop development uses pointer-lock look and keyboard flight. W/↑ leans
forward and descends, S/↓ leans backward and climbs, A/← leans left into a left
turn, and D/→ leans right into a right turn. Forward/backward tilt sets a held
flight angle up to 45 degrees at constant path speed; centered input flies level.
Mouse and headset movement change only the local view; they do not steer. Releasing a desktop flight key eases
that keyboard tilt back to center over 0.25 seconds; M5 keeps its existing
response.
Keyboard and M5 can act together on the same global flight model in every
experience.

The Experience page provides rehearsal transport. The Conductor page hosts the
same show in-process for station operation. Show owns playback, language, time,
and narration; UI only sends commands and displays observations.

English and German narration share one typed schedule. The audio timebase is
show-time authority, so suspended audio does not silently advance the piece.
Exact visitor replacement, calibration, physical comfort, and installation
acceptance remain issue-owned work.
