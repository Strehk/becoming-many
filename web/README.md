# Web release

Becoming Many in the browser: a start menu in front of the real experience,
for desktop, VR headset and phone. It runs the application's own code from
`src/` and its public files from `public/`; the installation is untouched.

## Run and build

The menu is the root page of the application: `src/ui/index.html` loads
`main.js` and the styles from this folder, and the root `vite.config.ts`
builds it beside the rehearsal page (`/dev`), the Conductor and Flash.

```bash
bun run dev
```

```bash
bun run build:release
```

The legal notice and privacy policy need the operator's details, which are
not committed: set `LEGAL_NAME`, `LEGAL_STREET`, `LEGAL_CITY`, `LEGAL_EMAIL`
(and optionally `LEGAL_COUNTRY`) in the environment or in the repository's
`.env` (see `.env.example`), and `SITE_URL` for the share preview. The
release build (`--mode release`, also used by `bun run deploy`) stops while
one is missing; every other build only warns.

The build lands in `dist/` and is published as static assets on Cloudflare
Workers (`wrangler.jsonc`); unknown paths answer with `public/404.html`.
`public/share.png` is the share preview image.

## What it does

- **Loading.** A spinner made of the world's own air particles (with a
  stand-in on a plain canvas until the world exists) turns until the Show's
  Run has started behind the menu and the narrator's first recording is in.
  Then the same particles write the title, "Becoming Many".
- **Menu.** Start, Settings, Credits, and the legal notice and privacy
  policy. Start leads to the choice of desktop, VR headset or phone; this
  device's way is marked recommended and starts at once. The other device's
  way shows how to get there (on a computer, a QR code for the phone) and
  offers "start here" for a device taken for the wrong one; VR without a
  headset shows how to bring one.
- **Seamless start.** The menu draws into the experience's own world; choosing
  a way in lets the Show play around the same particles. Two cards come first
  (headphones, then how to fly, with the device's other ways to steer to
  switch to); a click skips them.
- **Flight.** Desktop: W A S D or the arrow keys, or the arms as wings in
  front of the webcam (pose model in `pose/`, shipped with the page). Phone:
  turning it like a steering wheel, or turning around with it (360°). VR
  headset: one click on VR starts the piece in the headset, and the flight
  goes where the visitor looks; the view stays level and still in the world
  while the flight turns beneath it (no ICAROS pitch assistance). An
  autopilot flies on its own and hands over when the visitor steers. Touch
  (a finger, or the mouse) works on both, and takes over on a phone whose
  motion sensor is missing or not allowed.
- **Settings**, from the gear or Esc, pause the piece. Grouped as general
  (language, volume), flight (controls with the recommended one marked,
  invert look, autopilot) and display (graphics, fullscreen), plus a timeline
  to jump between chapters; rows that do nothing for the chosen way are left
  out, and the page scrolls on small screens.
- **Sound** is set up for phones and busy computers: one sound context with
  a roomy output buffer, the organ's echo rooms as native convolution instead
  of Freeverb's eight AudioWorklets each, a show clock that counts real time
  while sound runs (a starved audio callback loses time and the narration
  gets pulled back), and every recording of the language loaded in the
  background. The installation keeps its own sound; these are opt-ins.
- **End.** On a screen the title forms again over the credits; a headset
  keeps the world's own credits panel.

## Files

- `main.js`: the page's wiring to the Run (the page itself is
  `src/ui/index.html`).
- `autopilot.js`, `camera-steering.js`, `early-spinner.js`: one job each.
- `lib/`: the menu flow, its sound, and the borrowing of the air particles
  (spinner, title, click burst).
- `styles/`: the monochrome menu language, its layout and the page's pieces.
