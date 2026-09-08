# Conductor UI — 2026-09-08

The user requested a restrained implementation of the supplied mockup using
existing CSS surfaces and Lucide icons. Play/Pause and immediate Stop replace
the old clock/cue/nudge/New visitor controls. Stop uses Run's existing
time/flight reset and pause; language is retained. The preview belongs to the
main surface. Technician controls retain explicit XR start/stop.

## Verification

- `bun run lint` and `bun run build`: passed.
- Focused Conductor, flight-reset and UI markup checks: 23 passed.
  The concurrent retirement of test.html required updating the existing entry
  list in the markup-boundary test; its remaining assertions are unchanged.
- Existing production browser smoke: [21/21 passed](smoke.json).
  Source digest `ad0e63094fc84e2f128b502ee06b9d00fdb875f0345367efa05d0555d91cca88`
  identifies the tested candidate. Subsequent concurrent engine changes need
  their own verification; this report covers the Conductor implementation.
- Checked Play/Pause, single-click Stop, replay, languages, keyboard focus,
  timeline release/cancel, drawer focus/inert/cleanup and accepted M5 geometry.
  Shared routes and startup/mount failures also passed.
- The [initial failures](initial-failures.json) were test synchronization defects:
  the narrow timeline was outside the viewport, and synthetic cancellation
  preceded the final displayed pointer position. The existing test now scrolls
  the track into view and waits for its 20% playhead before ending the gesture.
  Assertions were retained; the final source passes them.
- IAB inspection found zero SVG geometry in development with relative
  `../../node_modules` links. Standard Vite SVG URL imports now bind the
  declared `use` elements. Dev and production both show nonzero icon geometry;
  only the ten required SVG assets are included, without an icon runtime.
- An IAB simulation of available XR recorded zero requests before input and
  exactly one immersive-session request on the wake click. The deliberately
  rejected request never displayed Streaming. Reload removed the simulation.

No physical PICO/Windows-PCVR, active-session transport, M5 hardware or 90 Hz
acceptance is claimed. XR still pauses the desktop preview; no second render
pass was introduced. Performance measurements from concurrent work are separate.

## Visual comparison

Source: [user mockup](mockup.png), 1672 × 940 pixels.
Implementation: [desktop](conductor-1672.png), 1672 × 940 CSS/pixels at density 1;
also [1280 desktop](conductor-1280.png), [390 narrow](conductor-390.png) and
[technician tools](conductor-technician.png).
Both full views were inspected together. The Scent section is held in both;
the implementation shows its actual renderer and schedule rather than the
mockup's illustrative landscape and equal-width chapter segments.
All labels and controls are readable in the full captures, so no extra crops
were necessary.

- Typography: existing system monospace retained; large transport labels and
  existing small status/language/chapter labels deliberately precede typography
  refinement.
- Spacing/layout: status above, equal desktop control/preview columns, language
  below transport, timeline spanning both. Below 920 px the existing panels stack.
- Colors: existing green/amber/alarm tokens and square surfaces retained.
  Dark foreground on bright buttons provides high contrast. No new theme.
- Images/icons: actual single renderer, official Lucide SVGs. No replacement
  landscape, decorative effects or generated visual assets.
- Copy: Play changes to Pause, Stop replaces the visitor reset wording, and
  separate clock/remaining/now/next text is removed.

Comparison history: the first dev capture exposed missing icon geometry;
URL imports fixed it. A final no-wrap experiment for narrow status tiles was
removed because it increased width. The final Conductor UI and retained passed
screenshots match. Mobile icon wrapping and smaller secondary labels
remain optional refinements under the user's existing-CSS-first constraint.
No actionable P0/P1/P2 findings remain for this scoped first pass.

final result: passed
