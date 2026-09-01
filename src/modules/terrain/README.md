# Terrain

This module renders a finite recycled view of the infinite `WorldSurface`. It
does not define ground shape, rivers, or zones. It always queries
`WorldSurface.groundYAt()` while generating mesh vertices and can consume one
optional diagnostic zone presentation.

Terrain owns its neutral material color and renders the carved river bed as
solid ground. It does not classify zones or draw a water surface. A Rivers
module can later query `surfaceYAt()` without changing terrain geometry.

The diagnostic Zone Visualizer supplies one material and the shared
`zoneConditionsAt(x, z)` query. Terrain stores the four continuous conditions
in one optional `vec4` vertex attribute. The GPU interpolates those values and
classifies each pixel, so hard test boundaries can cross triangles instead of
following a vertex-color staircase. Disabling the visualizer removes the
attribute and all zone sampling from Terrain.

`terrain.ts` owns lifecycle, one `ChunkWindow`, queue jobs, and the fixed mesh
pool. `terrain-geometry.ts` owns Three.js geometry, row sampling, atomic chunk
publication, bounds, and disposal.

Adding `terrain` to a level enables the module. Its only direct geometry
parameter is `opacity`, following Three.js semantics from `0` (invisible) to
`1` (opaque). Optional diagnostic presentation and material effects are nested
under the same level entry but remain separate module-owned implementations.

No terrain texture asset is selected yet, so the geometry does not allocate a
UV attribute. A later texture implementation must add its real data path rather
than expose a switch that has no visible effect. Fully opaque terrain stays on
Three.js's cheaper opaque material path.

The current MVP uses 64-metre chunks with 32 segments per side. With the
Test Level 180-metre view distance, the fixed resident window is 7×7 meshes.
When the player crosses a chunk boundary, only the incoming edge is rebuilt.
Each job samples one vertex row per queue step. It writes into fixed staging
arrays and publishes only after the complete chunk is ready, so visible meshes
never contain a partially generated landscape.

Neighboring chunks include the same border coordinates. Since both call
`groundYAt()` and optional `zoneConditionsAt()` at the same absolute position,
their data matches without chunk-specific stitching logic.

The height field combines signed rolling terrain, small detail, and ridged
mountains controlled by a slowly changing region mask. This produces deep
valleys, calm lowlands, and mountain regions without discrete landscape-type
boundaries.

## Ground occluder

`ground-occluder.ts` presents the same streamed surface as a depth-only
occluder: it writes depth and no color, and it overrides the drawn
resolution down to 8 segments per side because it is never seen. A level
that keeps its surface invisible uses it so that a ridge still hides what
stands behind it. It is a `TerrainPresentation` like any other, so it needs
no separate mode inside the module.
