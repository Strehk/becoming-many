<!--
Purpose: Document the canonical location for runtime audio assets.
Context: Vite serves files under public unchanged at the application root.
Responsibility: Record what ships here and how the runtime addresses it.
Boundary: Source recordings and intermediate exports stay outside public.
-->

# Audio Assets

This folder contains the audio that ships with the experience. Runtime files
stored here are served from `/audio/`.

`en/` and `de/` hold the narration, `1.mp3` to `8.mp3` in script order. The
script has nine sections but eight recordings: file 7 carries Finale and
Overload as a single take. `src/dramaturgy/narration-catalog.ts` maps cue names
onto these file stems and records each recording's measured length.

Both languages ship, so the built site carries about 15 MB of narration, but a
session only fetches the one language it was started with.
