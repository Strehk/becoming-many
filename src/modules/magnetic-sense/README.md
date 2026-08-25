# Magnetic Sense

This module contains the magnetic-field perception rendered through the
existing Terrain surface.

An analytical world-space stream coordinate produces stable terrain-draped
stripes. The base lines blend over the selected Terrain presentation at 20%
opacity. Narrow, bright light pulses stay strictly inside those line boundaries
and carry the primary visual emphasis. Pixels outside the stripes retain the
selected Terrain presentation color. The implementation adds no mesh, light,
texture, transparent layer, bloom, or post-processing pass.

The Level Runtime passes Zone Visualizer as the current base presentation and
Magnetic Sense as a material effect. Terrain keeps geometry and material
lifecycle ownership; Magnetic Sense owns only its stripe math, shader source,
parameters, and time update. Grass has no magnetic imports or color behavior.
Sky and horizon effects remain outside this MVP.
