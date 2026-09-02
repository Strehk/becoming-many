<!--
Purpose: Describe how to open the two station windows in a Chromium browser
  with no UI to navigate away from the piece.
Context: A station PC runs the station server and shows the experience page
  and the operator page; the audience must not reach the browser itself.
Responsibility: Give the launch commands, name the flags that matter and why,
  and state the limits of what a browser can lock down.
Boundary: What the process serves is station/README.md; where the pages come
  from and why they must be http://localhost is docs/direction/deployment.md.
-->

# Kiosk browser setup

A station serves two pages from `http://localhost` (see
[station/README.md](station/README.md)):

- the experience page, `http://localhost/`
- the operator page, `http://localhost/conductor.html`

Both open as Chromium **app windows** — no address bar, no tab strip, no
bookmarks bar, and no way to type a URL — while staying windowed, so one
monitor can carry both.

Keep the `http://localhost` origin. Kiosk flags change no origin rules, and
localhost is what keeps WebXR in a secure context and lets the show poll the
M5 over plain HTTP.

## Station PC (Windows)

Two commands, one per window. Sizes and positions suit a 2048-wide monitor;
adjust them to the station's screen.

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="C:\becoming-many\kiosk-show" ^
  --app=http://localhost/ ^
  --window-position=0,0 --window-size=1280,800 ^
  --autoplay-policy=no-user-gesture-required ^
  --no-first-run --no-default-browser-check ^
  --noerrdialogs --disable-session-crashed-bubble ^
  --disable-background-timer-throttling ^
  --disable-backgrounding-occluded-windows ^
  --disable-renderer-backgrounding ^
  --disable-features=Translate,TranslateUI ^
  --check-for-update-interval=31536000 ^
  --overscroll-history-navigation=0
```

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="C:\becoming-many\kiosk-conductor" ^
  --app=http://localhost/conductor.html ^
  --window-position=1290,0 --window-size=760,800 ^
  --no-first-run --no-default-browser-check ^
  --noerrdialogs --disable-session-crashed-bubble ^
  --disable-background-timer-throttling ^
  --disable-backgrounding-occluded-windows ^
  --disable-renderer-backgrounding
```

## Development machine (macOS, Linux)

The same flags with a different binary. On Linux use `chromium` or
`google-chrome`; on macOS:

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" \
  --user-data-dir="$HOME/.becoming-many/kiosk-show" \
  --app=http://localhost/ \
  --window-position=0,0 --window-size=1280,800 \
  --autoplay-policy=no-user-gesture-required \
  --no-first-run --no-default-browser-check \
  --noerrdialogs --disable-session-crashed-bubble \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --overscroll-history-navigation=0 &

"$CHROME" \
  --user-data-dir="$HOME/.becoming-many/kiosk-conductor" \
  --app=http://localhost/conductor.html \
  --window-position=1290,0 --window-size=760,800 \
  --no-first-run --no-default-browser-check \
  --noerrdialogs --disable-session-crashed-bubble \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding &
```

## Why these flags

- `--user-data-dir` **per window is not optional.** Without it the second
  command hands its URL to the browser instance the first one started, which
  opens a plain tab in a normal window and ignores every other flag.
- `--autoplay-policy=no-user-gesture-required` — the narration and the sound
  layer otherwise wait behind a suspended audio context until someone clicks
  the show window. Silence is the failure mode.
- `--disable-background-timer-throttling`,
  `--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding` — with both windows on one monitor only
  one is focused, and overlapping windows occlude each other. Chromium then
  throttles timers and animation frames in the other window: the M5 poll loop
  in the show, the broker socket in the conductor. Prefer side by side over
  overlapping, and keep all three flags.
- `--noerrdialogs`, `--disable-session-crashed-bubble` — after a hard
  power-off the default is a restore bubble over the piece.
- `--check-for-update-interval=31536000` — an exhibition should not change
  under its operators, the same reason updating the image is an explicit
  `docker compose pull`.
- Do **not** add `--incognito`: it discards the HTTP cache, so every restart
  refetches the world assets.

## What this does and does not lock

An app window removes the UI to navigate away. It is not a lock:

- Keyboard shortcuts still work. On Windows `Ctrl+N` opens a normal browser
  window from an app window.
- On macOS the global menu bar stays, with File → New Tab and Open Location
  live, so on a Mac these windows are presentable but escapable.

The real lock is `--kiosk` in place of `--app`, which removes the window frame
and every exit but `Alt+F4` — at the cost of forcing fullscreen, so it fits the
show window on an installation monitor rather than two windows on one screen.

Two things no browser flag covers: the station PC needs a power plan that never
sleeps or blanks the display, and entering VR needs a real click. The Three.js
`VRButton` will not accept a synthetic gesture, so an operator starts each
session by hand.
