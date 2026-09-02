<!--
Purpose: Document the one-process station server and its Docker deployment.
Context: A station PC runs this process and opens two browser windows on it.
Responsibility: Explain what the process does, its endpoints, its env vars,
  and what it deliberately does not do.
Boundary: The wire contract and both clients live in ../src/station.
-->

# Station server

`bun run station` starts the one process a station needs beyond a browser: it
serves the built pages from `dist/` and it is the localhost broker that
[Deployment](../docs/direction/deployment.md) calls for — the experience page
and the operator page each hold one WebSocket to it, and it passes messages
between them.

It runs under Bun, not in a browser, which is why it sits here rather than in
`src/` — the same split as the Chromium benchmark runner in `tests/benchmark/`,
which drives `src/benchmark`. Nothing in either page's module graph imports it,
so Vite never bundles it and it exports nothing.

`bun run m5-sim` starts a second small Bun process from this folder: a stand-in
M5 controller answering `GET /state` with a slow tilt sweep, for developing the
polling chain without hardware (`--device` and `--firmware` flags exercise the
wrong-device and firmware-mismatch warnings).

## Endpoints

- `/` and `/conductor.html` — the built pages, served from `dist/` (run
  `bun run build` first; in development the pages come from `bun run dev`
  instead, which proxies the paths below here).
- `/station?role=show|conductor` — the WebSocket broker. A `role` query
  upgrades on any path, so a `?station=<url>` override without the path keeps
  working.
- `/health` — liveness JSON: uptime and connected role counts. It reports the
  process, never the show: a healthy server with zero windows is healthy.
- `/config` — the deployment facts the process was started with, for the
  pages to fetch on load (`src/station/deployment-config.ts`).

## Environment

Every variable is optional; a set one is deployment authority and the
matching conductor control turns read-only. See [.env.example](../.env.example)
for the full descriptions.

- `PORT` — listen port (default 7823).
- `M5_HOST` — this station's M5 controller; the show polls it from startup.
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

The pages are then at `http://localhost/` and `http://localhost/conductor.html`
(port 80 by default — `HOST_PORT` in `.env` moves it). Serving from
`http://localhost` is what keeps WebXR and plain-http M5 polling working; see
the deployment direction. `docker compose --profile sim up -d` adds the M5
simulator on port 5183 for a station without hardware — point the station at
it with `M5_HOST=localhost:5183`.

## What the broker does

- Accepts `?role=show` and `?role=conductor`, and refuses anything else.
- Relays conductor commands to the show, and show status back to conductors.
- States peer presence when a socket opens or closes, so a conductor can tell a
  closed show window from a show that is merely paused.
- Drops any message the contract does not describe, and drops presence claimed
  by a page — that is the broker's own statement, and accepting it would let one
  window lie about another.

## What it does not do

It holds no show state, keeps no schedule, and decides nothing about the piece.
The show clock stays the single authority; this process only carries words
between two windows. The show does not depend on it either: with no broker
running, the station link retries quietly and the piece plays exactly as it does
without a station. The deployment env vars pass through `/config` unread —
what each fact means is decided by the page that applies it.
