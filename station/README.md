<!--
Purpose: Document the one-process station server and its Docker deployment.
Context: A station PC runs this process and opens one browser window on it.
Responsibility: Explain what the process does, its endpoints, its env vars,
  and what it deliberately does not do.
Boundary: The deployment-config contract the pages read lives in ../src/station.
-->

# Station server

`bun run station` starts the one process a station needs beyond a browser: it
serves the built pages from `dist/`, and it hands the pages the deployment
facts it was started with. The station window itself is the conductor page,
which hosts the show in-process — this process carries no show traffic.

It runs under Bun, not in a browser, which is why it sits here rather than in
`src/` — the same split as the Chromium benchmark runner in `tests/benchmark/`,
which drives `src/benchmark`. Nothing in either page's module graph imports it,
so Vite never bundles it and it exports nothing.

`bun run m5-sim` starts a second small Bun process from this folder: a stand-in
M5 controller answering `GET /state` with a slow tilt sweep, for developing the
polling chain without hardware (`--device` and `--firmware` flags exercise the
wrong-device and firmware-mismatch warnings).

## Endpoints

- `/conductor.html` — the station window, served from `dist/` (run
  `bun run build` first; in development the pages come from `bun run dev`
  instead, which proxies `/config` here). `/` stays the bare rehearsal page.
- `/test.html` and named paths such as `/echo` — standalone development levels,
  benchmarks, and opt-in diagnostics.
- `/health` — liveness JSON: status and uptime. It reports the process, never
  the show: a healthy server with zero windows is healthy.
- `/config` — the deployment facts the process was started with, for the
  pages to fetch on load (`src/station/deployment-config.ts`).

## Environment

Every variable is optional; a set one is deployment authority and the
matching conductor control turns read-only. See [.env.example](../.env.example)
for the full descriptions.

- `PORT` — listen port (default 7823).
- `M5_HOST` — this station's M5 controller; the conductor page arms the show
  with it from startup.
- `M5_DEVICE_ID` — deviceId every M5 payload must carry.
- `STATION_NAME` — label telling a technician which station this is.

## Docker

One command runs a station from the released image, restarted on failure and
health-checked (the Dockerfile probes `/health`); the station PC needs no
toolchain beyond Docker:

```sh
cp .env.example .env   # fill in per station, every value optional
docker compose up -d
```

Publishing a GitHub release builds the image and pushes it to
`ghcr.io/strehk/becoming-many` (`.github/workflows/release-image.yml`).
`docker compose pull` updates a station to the newest release — an explicit
step, so an exhibition never changes under the operators by itself. Building
from the checkout instead of pulling layers the build override on top:

```sh
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

The station window is then at `http://localhost/conductor.html` (port 80 by
default — `HOST_PORT` in `.env` moves it). Serving from `http://localhost` is
what keeps WebXR and plain-http M5 polling working; see the deployment
direction. `docker compose --profile sim up -d` adds the M5 simulator on port
5183 for a station without hardware — point the station at it with
`M5_HOST=localhost:5183`.

The window is opened in a Chromium browser with no UI to navigate away from
it: [start-kiosk.bat](start-kiosk.bat) opens it on the Windows station PC, and
[KIOSK.md](../KIOSK.md) explains the flags and what they do and do not lock
down.

## What it does not do

It holds no show state, keeps no schedule, and decides nothing about the piece.
The show clock stays the single authority, inside the conductor page; this
process only serves files and facts. The show does not depend on it either:
`bun run dev` serves the same pages without it, and with no server answering
`/config` the pages read an empty deployment and play unchanged. The env vars
pass through `/config` unread — what each fact means is decided by the page
that applies it.
