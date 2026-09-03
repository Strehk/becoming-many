# Asset Loader

This utility loads the explicit GLTF sets selected by the active level. URLs
are deduplicated inside each module request set during preload; manifests
remain attribution and inspection metadata rather than a second runtime
configuration source.

Keep it focused on loading, validation, and resource handoff. Feature-specific
placement, lifecycle, and ownership belong to the consuming module.

`static-model.ts` extracts every Mesh below one named GLTF object. The object
may be a single Mesh or a Group, so multi-part trees and rocks stay complete.
It preserves each part's authored transform and creates opaque unlit materials
for the mobile-first runtime.

`instanced-model-pool.ts` is the shared GPU mechanism proven by Vegetation and
Rocks. Modules write accepted model matrices into fixed chunk slots. Publishing
compacts all completed slots at most once per module frame, so unused capacity
remains allocated but is not drawn. Zone rules, density, candidates, and
streaming decisions do not live here.
