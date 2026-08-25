# Zone Visualizer

This test module makes the procedural zone map visible while developing the
landscape. It maps water, meadow, conifer forest, deciduous forest, and shrub
slope to distinct colors.

The module owns the diagnostic colors and the small unlit material extension.
Terrain remains the sole owner of meshes, vertex buffers, chunk streaming, and
resource disposal. The Level Runtime connects the visualizer to Terrain when a
level selects the `zones` terrain presentation.

The visualizer never treats colors as landscape facts. Terrain forwards four
continuous conditions in one `vec4`; the fragment shader applies hard zone
thresholds after GPU interpolation. This keeps the low-poly terrain while
removing grid-shaped color boundaries. It adds no meshes, draw calls, textures,
or separate lifecycle.
