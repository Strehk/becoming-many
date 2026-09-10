# Point Cloud

The shared Air Particles effect lives here. It renders the confirmed snow-like
field of drifting points for Start and the other level recipes.

## Files

- `point-cloud.module.ts`: World lifecycle, resident volumes and queued recycling.
- `point-cloud-geometry.ts`: deterministic positions, fixed buffers and disposal.
- `point-cloud-material.ts`: point material, shader bindings and time uniform.
- `point-cloud-settings.ts`: density, appearance, movement and streaming parameters.
- `point-cloud-motion.vert.glsl`: GPU drift and point visibility.
- `point-cloud-circle.frag.glsl`: optional circular point shape.
- `point-cloud-distance.frag.glsl`: optional near/far fading.

## Integration

Level Composition creates this module through `createAirParticlesModule`.
The existing `airParticles` recipe and public names remain shared across levels.
The Start architecture outline remains separate from this working background.

World drives load, activate, update, deactivate and unload. One Points object
combines the resident volumes into one draw call. Movement advances one shader
uniform; crossing a volume boundary updates only recycled buffer ranges through
World's existing StreamQueue. The module owns its geometry and material.

Imports stay within this effect or use Three.js and the existing World contracts,
volume window and stream queue. The effect has no dependency on Start game logic,
exercise chunks, narration or another renderer.
