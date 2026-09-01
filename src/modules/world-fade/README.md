<!--
Purpose: Document ownership of the world-fade surface effect.
Context: Show world states fade in and out instead of cutting.
Responsibility: Explain what belongs in src/modules/world-fade.
Boundary: When and how far to fade is decided by the show driver in level-runtime.
-->

# World Fade

One composable material effect that blends a surface's *finished* color toward
the live background, by a single 0..1 presence value. During a show, structure
condenses out of the haze as its introducing sense fades in, and dissolves
back into it on the return — without ever making a material transparent, so
the mobile GPU sees no transition-time overdraw or sorting.

`createWorldFade()` returns one instance per fading surface group; every
material the instance patches shares one presence and one background uniform.
The composition root applies it *first* in an effect list, which — by the
patch-ordering rule in `material-shader-patch.ts` — makes it execute *last*
and win the final color over every sense decoration.

The background uniform tracks the live, possibly mid-lerp clear color so the
mix target never lags behind the sky. Presence values come from the dramaturgy
(`senseIntensityAt`); this module knows nothing about schedules or time.
