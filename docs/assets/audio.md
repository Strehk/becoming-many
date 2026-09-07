<!--
Purpose: Document the canonical location for runtime audio assets.
Context: Vite serves files under public unchanged at the application root.
Responsibility: Record what ships here and how the runtime addresses it.
Boundary: Source recordings and intermediate exports stay outside public.
-->

# Audio Assets

`public/audio/narration/en/` and `public/audio/narration/de/` contain the
recordings served from `/audio/narration/<language>/<cue>.mp3`.

The eight file stems match the runtime cue IDs: `prologue`, `scent`, `echo`,
`motion`, `thermal`, `magnetic`, `finale`, and `return`. The script has nine
sections but eight recordings: `finale.mp3` (formerly `7.mp3`) carries Finale
and Overload as a single take under the existing inferred mapping.
[The script index](../../script/README.md) preserves the listening caveat.
`src/dramaturgy/narration-catalog.ts` records each recording's measured length;
no separate file-number mapping is needed.

Both languages ship, so the built site carries about 15 MB of narration, but a
session only fetches the one language it was started with.
