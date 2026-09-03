<!--
Purpose: Describe how to open the station window in a Chromium browser with
  no UI to navigate away from the piece.
Context: A station PC runs the station server and shows the conductor page,
  which hosts the show itself; the audience must not reach the browser.
Responsibility: Give the launch command, name the flags that matter and why,
  and state the limits of what a browser can lock down.
Boundary: What the process serves is station/README.md; where the page comes
  from and why it must be http://localhost is docs/direction/deployment.md;
  how an installed station keeps the window open unattended is
  watchdog/README.md.
-->

# Kiosk browser setup

A station serves its pages from `http://localhost` (see
[station/README.md](station/README.md)). The one window a station runs is the
operator page, `http://localhost/conductor.html` — it hosts the world
in-process and streams it to the headset from its own Start Stream button.
(`http://localhost/` stays available as the bare rehearsal and development
page; nothing at the installation opens it.)

The window opens as a Chromium **app window** — no address bar, no tab strip,
no bookmarks bar, and no way to type a URL — while staying windowed, so the
frame is still there for a technician.

Keep the `http://localhost` origin. Kiosk flags change no origin rules, and
localhost is what keeps WebXR in a secure context and lets the page poll the
M5 over plain HTTP.

## Station PC (Windows)

An installed station does not use the launcher below. It runs the window under
the Artcom Watchdog, from [watchdog/kiosk.yaml](watchdog/kiosk.yaml), which
waits for `/health`, opens the window with `--kiosk` rather than `--app`, and
marks the dedicated kiosk window as topmost. It also reopens Chrome after a
crash or a stray `Alt+F4` — see
[watchdog/README.md](watchdog/README.md), including how to stop it when
servicing the machine. The flags there and the flags here must stay in step.

[station/start-kiosk.bat](station/start-kiosk.bat) is the unsupervised
launcher, for rehearsals and for a technician who wants a window they can get
out of. It runs the command from one double-click: it finds an installed Chromium browser, waits for the station
server to answer `/health` so the window never opens on an error page, and
opens the window. The per-station values — URL, window position and size —
are the `set` lines at the top of the file; `BM_BROWSER` forces a specific
browser executable.

The command it runs, for a station that wants it by hand. Size and position
suit a 2048-wide monitor; adjust them to the station's screen.

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="C:\becoming-many\kiosk-station" ^
  --app=http://localhost/conductor.html ^
  --window-position=0,0 --window-size=1600,1000 ^
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

## Development machine (macOS, Linux)

The same flags with a different binary. On Linux use `chromium` or
`google-chrome`; on macOS:

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" \
  --user-data-dir="$HOME/.becoming-many/kiosk-station" \
  --app=http://localhost/conductor.html \
  --window-position=0,0 --window-size=1600,1000 \
  --autoplay-policy=no-user-gesture-required \
  --no-first-run --no-default-browser-check \
  --noerrdialogs --disable-session-crashed-bubble \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --overscroll-history-navigation=0 &
```

## Why these flags

- `--user-data-dir` **is not optional.** Without it the command hands its URL
  to an already-running browser instance, which opens a plain tab in a normal
  window and ignores every other flag.
- `--autoplay-policy=no-user-gesture-required` — the narration and the sound
  layer otherwise wait behind a suspended audio context until someone clicks
  the window. Silence is the failure mode.
- `--disable-background-timer-throttling`,
  `--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding` — an unfocused or occluded window gets
  its timers and animation frames throttled: the M5 poll loops, the operator
  readouts, the show itself. The window may share its monitor with other
  tools, so keep all three flags.
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
  live, so on a Mac this window is presentable but escapable.

The real lock is `--kiosk` in place of `--app`, which removes the window frame
and every exit but `Alt+F4` — at the cost of forcing fullscreen, which is fine
for a single station window. That is what an installed station runs, and the
kiosk watchdog closes the `Alt+F4` gap by reopening the window.

Two things no browser flag covers: the station PC needs a power plan that never
sleeps or blanks the display, and starting the headset stream needs a real
click. WebXR will not accept a synthetic gesture, so an operator presses
Start Stream by hand each session.
