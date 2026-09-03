<!--
Purpose: Reserve a utility boundary for shared audio asset loading.
Context: Current narration loading is owned directly by src/sound.
Responsibility: State when a shared loader would be justified.
Boundary: This folder currently contains documentation only and owns no playback policy.
-->

# Sound Loader

This is a README-only reserved extension boundary. No shared Sound Loader is
implemented because the current narration path has one owner and no duplicated
loading contract.

Extract a utility here only when a second real audio consumer needs the same
validated loading behavior. Narrative timing, playback, spatialization, voice
limits, and disposal remain with the consuming sound owner.
