<!--
Purpose: Document the current End Credits module.
Context: The show closes in White World and needs a visible authored ending.
Responsibility: Explain the panel, its pose, its cost boundary, and ownership.
Boundary: The credit lines and their timing are authored under src/dramaturgy.
-->

# End Credits

This module shows the piece's closing credits inside the world rather than
over it. A DOM overlay is invisible in an immersive WebXR session, so the
credits are one plane in the scene and the headset and the desktop rehearsal
view get the same ending from the same code path.

`end-credits-panel.ts` owns the whole lifecycle: one `PlaneGeometry`, one
`MeshBasicMaterial`, and one `CanvasTexture`, created on load and disposed on
unload. `setPresence` is the single runtime driver — it writes the material's
opacity and hides the panel entirely at zero, so an invisible panel costs no
draw call. There is no shader of its own: the material's opacity multiplies
the alpha already drawn into the texture, which is what makes the fade free.

`end-credits-texture.ts` paints the lines onto a transparent canvas — black
glyphs, no card, no box — in Rubik at weight 700, the one static weight
shipped at `public/fonts/rubik/Rubik-Bold.ttf` (`manifest.json` beside it
records the license and source). The font loads asynchronously through the
`FontFace` API, so the canvas paints once immediately in a fallback face and
once more, at most, when Rubik resolves — never per frame, and a failed load
just leaves the fallback paint standing. The type sizes come from the line's
semantic role, so a name is never recognised by comparing its text.
`end-credits-settings.ts` holds the panel's proportions and type scale; the
lines themselves are authored in `src/dramaturgy/end-credits.ts` and handed in
by Level Runtime, so this module never reads the schedule.

`end-credits-pose.ts` is the placement, kept pure so it is covered by
`bun test` without a browser. The panel rides a fixed distance ahead of the
**rig's** flattened heading — the direction of travel — at eye height and
square to the viewer. Anchoring to the course rather than to the head is what
lets a visitor turn to look around the panel in the headset while still flying
toward it, instead of through one left standing in the world. A rig aimed
straight up or down flattens to no heading at all, so the last usable one is
kept for those frames.

## Cost

One plane, one material, one texture, and one draw call while the credits are
visible; nothing at all before that. This is the piece's one transparent
surface, and deliberately so: an opaque plane would follow the world's
fade-to-background rule but would also occlude the air particles still
drifting through White World behind it. The canvas repaints at most once more
after load, when the shipped font resolves.

Level Runtime builds the panel only for a show. A requested development preset
and the deterministic benchmark route never reach an ending, so neither creates
the panel or its texture.
