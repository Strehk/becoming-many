# Dramaturgy and Audio

## Current

The piece uses one typed baked schedule and one show clock. The authored show is
8:45, including lead-in and the return to White World. Cue times select world
states and narration; sense intensities and visual transitions are derived from
the same show time. A cue may let its world lead its recording; only the return
does, so the closing words are spoken into a world that has already gone white.

English and German share cue timing. Language selects assets addressed by cue
id; `script/en.md` and `script/de.md` remain the authoritative wording. Changing
language re-arms narration at the current time and pauses the show for an
explicit restart.

Narration playback supplies the audio timebase. Pause, seek, and rehearsal
speed therefore keep sound and visuals aligned. A suspended browser audio
context also suspends show progress.

## Planned

Small sound additions may give perception layers bounded sonic counterparts.
They must use the existing show time, survive pause/seek, own and cap their
voices, and have a concrete issue. A second timeline, runtime curve editor, or
UI-heavy audio engine is outside the current need.

## Open

- Final narration recordings and authored cue timing may still be tuned by ear.
- Installation volume, headphones, ambience, and operator adjustment need venue
  acceptance.
- A separate tutorial is not implemented and should be added only if visitor
  testing demonstrates a need.
