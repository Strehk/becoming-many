# Magnetic Sense

This module contains the magnetic-field perception (level 06) with two
consumers sharing one field-direction and intensity uniform set: terrain
ground stripes and a sky-dome horizon glow. `createMagneticSense` returns
both as `{ terrain, sky }`; a future dramaturgy driver steers the whole
sense through the single shared uniform objects.

The terrain effect: an analytical world-space stream coordinate produces
stable terrain-draped stripes. The base lines blend over the selected
Terrain presentation at the preset-authored opacity. Narrow, bright light
pulses stay strictly inside those line boundaries and travel toward the
field direction. Pixels outside the stripes retain the selected Terrain
presentation color. The stripes add no mesh, light, texture, transparent
layer, bloom, or post-processing pass.

The sky cue: one opaque back-side dome that follows the full camera
position each frame (`magnetic-sky.ts`). Its fragment shader shows the
carried level haze everywhere except an analytic glow at the horizon
toward the field direction — the same direction the ground pulses flow
toward. With `depthWrite` off and `renderOrder` −1 it draws first and
every later opaque fragment paints over it; the shared intensity uniform
fades the glow back into the haze without transparency. One added draw
call, no extra render pass.

Line, pulse, and sky glow colors are preset-authored
(`MagneticSenseColors`); module tuning lives in
`magnetic-sense-settings.ts`. The Level Runtime orders the terrain effect
in Terrain's effect list and adds the sky as a world module. Terrain keeps
geometry and material lifecycle ownership; Grass has no magnetic imports
or color behavior.
