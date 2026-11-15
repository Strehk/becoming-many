# Web release

Becoming Many in the browser: a start menu in front of the real experience,
for desktop, VR headset and phone. It runs the application's own code from
`src/` and its public files from `public/`; the installation is untouched.

## Run and build

```bash
bunx vite web
```

```bash
bunx vite build -c web/vite.config.js
```

The build lands in `web/dist-pages/` with the base `/becoming-many/` (set
`PAGES_BASE` for another one) and is published as a static site on GitHub
Pages. The experience names its public files from the server root
(`/audio/...`, `/models/...`), so the build moves those paths under the base.

## What it does

- **Loading.** A spinner made of the world's own air particles (with a
  stand-in on a plain canvas until the world exists) turns until the Show's
  Run has started behind the menu and the narrator's first recording is in.
  Then the same particles write the title, "Becoming Many".
- **Menu.** Start, Settings, Credits, and the legal notice and privacy
  policy. Start leads to the choice of desktop, VR headset or phone; a way
  the device cannot take is greyed out.
- **Seamless start.** The menu draws into the experience's own world; choosing
  a way in lets the Show play around the same particles. Two cards come first
  (headphones, then how to fly); a click skips them.
- **Flight.** Desktop: W A S D or the arrow keys, or the arms as wings in
  front of the webcam (pose model in `pose/`, shipped with the page). Phone:
  turning it like a steering wheel, or turning around with it (360°). An
  autopilot flies on its own and hands over when the visitor steers.
- **Settings**, from the gear or Esc, pause the piece: language, volume,
  graphics, invert look, autopilot, controls, fullscreen, and a timeline to
  jump between chapters.
- **End.** On a screen the title forms again over the credits; a headset
  keeps the world's own credits panel.

## Files

- `index.html`, `main.js`: the page and its wiring to the Run.
- `autopilot.js`, `camera-steering.js`, `early-spinner.js`: one job each.
- `lib/`: the menu flow, its sound, and the borrowing of the air particles
  (spinner, title, click burst).
- `styles/`: the monochrome menu language, its layout and the page's pieces.
