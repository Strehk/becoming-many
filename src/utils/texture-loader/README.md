<!--
Purpose: Reserve a utility boundary for shared runtime texture loading.
Context: Current modules own the textures they create or load.
Responsibility: State when a common loader would be justified.
Boundary: This folder currently contains documentation only and owns no materials.
-->

# Texture Loader

This is a README-only reserved extension boundary. No shared Texture Loader is
implemented because current texture ownership remains local to modules.

Extract common code here only after multiple consumers require the same loading,
validation, color-space, or disposal behavior. Material choices, sampling
policy, visual contracts, and texture lifetime remain explicit at the consumer
boundary.
