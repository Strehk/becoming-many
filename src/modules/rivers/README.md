# Rivers

World Surface already owns the river path, carved bed, and water conditions.

For the current visual MVP, Terrain uses those existing conditions to apply the
level's `waterColor` directly to the river bed. There is no Rivers runtime,
additional geometry, transparency, reflection, texture, or animation.

Levels that carry the echo depth ramp reach the same bed a second way, because
the ramp replaces every base color the Terrain presentation produces: Echo
Depth accepts its own optional `waterColor` and holds the water surface out of
the ramp. That is still only a color on the carved bed — the same MVP by a
different route, chosen because a level showing the depth response has no
Terrain presentation for the first route to color.

A separate Rivers module is deferred until the design actually requires a
water surface above the ground and its PICO cost has been validated.
