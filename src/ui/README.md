# Browser UI

The four HTML documents in this folder retain the public routes `/`,
`/conductor.html`, `/test.html` and `/flash.html`. Each links `app.css` and loads
its browser bootstrap from `src/entry/`.

HTML owns authored controls, SVGs and repeated templates. Surface controllers
bind declared elements, update observations and end their listeners, timers,
subscriptions and owned clones. Static markup survives UI cleanup. `shared/`
contains only currently reused DOM bindings, transport scrubbing, time formatting
and XR controls; surface-specific behavior stays with its surface.

Entry resolves deployment inputs, connects UI to existing owner commands and
owns page-exit cleanup. Show owns playback, Run owns experience lifetime and
World owns rendering resources while borrowing the declared canvas/viewport.
Frame metrics live outside UI in `src/diagnostics/`; the Test module loader
belongs to Entry. Device validity stays in M5, whose `readObservation()` never
consumes frame input.

Icons reference individual `lucide-static` SVG assets with declarative `<use>`
elements. Keep `?no-inline` on their URLs: browsers reject data URLs in SVG
references, so Vite must emit external files.

Flash is independent of Run. Its [page](flash/README.md) binds setup controls;
Entry connects them to the serial adapter. The [Conductor](conductor/README.md)
documents operator-specific contracts. See the
[Engineering Standards](../../docs/engineering-standards.md#declarative-browser-ui)
for markup, styling and lifecycle rules.
