# Rivers

World Surface already owns the river path, carved bed, and water conditions.

For the current visual MVP, Terrain uses those existing conditions to apply the
level's `waterColor` directly to the river bed. There is no Rivers runtime,
additional geometry, transparency, reflection, texture, or animation.

A separate Rivers module is deferred until the design actually requires a
water surface above the ground and its physical PCVR cost has been validated.
