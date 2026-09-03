# 04 — Motion Perception

## Current Experience

Motion Perception keeps the Echolocation world and adds signals that exist
through movement: persistent fly swarms, bird traces, and GPU-aged trails. The
new layer begins with its narration cue at 2:47.

## Runtime Ownership

[`motion.level.ts`](../../../src/levels/motion.level.ts) carries the Echo preset
and adds the shared motion settings. Motion Sense owns a bounded simulation,
fixed trail rings, and all rendering resources. Moving providers can cross its
boundary only through `MotionPointSource`; concrete modules do not import it.

Only the newest trail slot is written per actor and frame. Trail age, drift,
fade, and collapse are derived in the shader from the shared frame state.

## Current Risks

The level shares the project-wide transition, shader-patch, and physical PICO
gates. Further actors or visual layers are product changes and require a small
issue with a measured capacity impact.
