# 03 — Echolocation

## Current Experience

Echolocation reveals the solid landscape: Terrain, Vegetation, Rocks, and the
Grass Clipmap appear through a camera-distance colour ramp. Air and Scent remain
active underneath because narrative senses layer.

The narration cue begins at 2:14. The show fades the solid world in without
teleporting the visitor or creating a second scene.

## Runtime Ownership

[`echo.level.ts`](../../../src/levels/echo.level.ts) owns the sparse authored
composition. Echo Depth is one material effect applied to Terrain, Vegetation,
Rocks, and clipmap grass through shared shader contracts. Each content module
retains its own geometry, placement, and lifecycle.

Grass Clipmap is the narrative grass implementation from this level onward. The
older Grass module remains in diagnostic presets only while issue #13 evaluates
one owner using current measurements.

## Current Risks

- Grass Clipmap performance has desktop evidence but no complete physical PICO
  acceptance.
- First-use material compilation contributes to transition-risk issue #16.
- Shader patch validation is tracked in issue #20.
