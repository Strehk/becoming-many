<!--
Purpose: Describe how a station PC keeps itself running unattended, and what
  each Watchdog config is responsible for.
Context: Two identical stations run for exhibition days with no one watching
  the desktop. Every layer below has its own restart story; this folder is
  where those stories are joined into one that survives a power-cycle.
Responsibility: Name the install layout, the supervision chain, the UDP ports,
  and the few things an operator has to do by hand.
Boundary: What the browser flags do is ../KIOSK.md. What the container serves
  is ../station/README.md. Where the pages must come from and why is
  ../docs/direction/deployment.md.
-->

# Station supervision

A station PC runs five things that must not be down at opening time: Docker
Desktop, the station stack inside it, SteamVR, the PICO streaming client, and
the kiosk window. Each is one instance of the Artcom Watchdog v0.3.0 with one
config file from this folder.

## What supervises what

| Config | Supervises | UDP | Recovers |
| --- | --- | --- | --- |
| `docker.yaml` | `Docker Desktop.exe` | 2348 | Docker Desktop gone or crashed; runs the compose bring-up after each launch |
| `station.yaml` | a `/health` poller | 2349 | a station that stopped answering, whatever the reason |
| `steamvr.yaml` | `vrmonitor.exe` | 2346 | SteamVR gone or crashed |
| `pico.yaml` | `PICOBusinessStreaming.exe` | 2347 | the streaming client gone or crashed |
| `kiosk.yaml` | `chrome.exe` | 2350 | a closed, crashed or killed kiosk window |

## Why the station is watched twice

`docker-compose.yml` sets `restart: unless-stopped`, so Docker itself brings a
crashed container back. Supervising the container would duplicate that. What
Docker cannot restore is Docker Desktop: once that is gone, the restart policy
has nothing left to act on. That is `docker.yaml`.

A running `Docker Desktop.exe` is not proof of a working engine, though. It can
hang with its tray icon in place, a container can sit in a crash loop, a port
can fail to bind — and all of those look identical from outside: a healthy
process list in front of a black kiosk window. So `station.yaml` supervises
[bin/poll-health.bat](bin/poll-health.bat), which rewrites
`run\station.hb` for as long as `http://localhost/health` answers and stops
touching it the moment it does not. Watchdog's heartbeat monitoring turns that
stale file into a restart, and the restart re-runs
[bin/docker-up.bat](bin/docker-up.bat) — about sixty seconds from a dead
station to a bring-up, without anyone in the room.

Nothing tears the stack down. `restart: unless-stopped` is what carries it
across a reboot, and `docker compose down` on a watchdog stop would only add a
cold container start to every restart.

## Install

Copy this folder to `C:\Watchdog` on the station PC and put the Watchdog v0.3.0
binary beside the configs:

```text
C:\Watchdog\
  Watchdog.exe
  start-station.bat
  docker.yaml  station.yaml  steamvr.yaml  pico.yaml  kiosk.yaml
  bin\  docker-up.bat  poll-health.bat  wait-health.bat
  logs\   created on first start
  run\    heartbeat file and the kiosk browser profile
C:\becoming-many\
  docker-compose.yml
  .env
```

The configs carry absolute paths. If either root moves, the paths in the
`.yaml` files and `PROJECT_DIR` at the top of `bin\docker-up.bat` move with it.

Then:

1. **Turn off Docker Desktop's "Start Docker Desktop when you sign in."**
   `docker.yaml` owns that process. Two owners fight over it, and the loser is
   whichever one launches second.
2. Set a power plan that never sleeps and never blanks the display.
3. Check the two installed paths in `docker.yaml` and `kiosk.yaml` against the
   machine — Chrome in particular is also found at `Program Files (x86)` and
   under `%LOCALAPPDATA%`.
4. Put a shortcut to `start-station.bat` in the Startup folder
   (`shell:startup` in the Run dialog), so a power-on brings the station up.

`start-station.bat` launches one minimised Watchdog per config and exits; the
five windows stay in the taskbar and the logs land in `C:\Watchdog\logs`.

## Operating it

Each watchdog listens for plain-text UDP commands — `start`, `stop`, `restart`,
`reboot`, `halt`, and `status` — on its port from the table above. From the
station PC:

```powershell
# Ask the station watchdog how it is doing: ok / loading / error ...
$c = [System.Net.Sockets.UdpClient]::new()
$c.Connect("127.0.0.1", 2349)
$c.Send([Text.Encoding]::ASCII.GetBytes("status"), 6) | Out-Null
```

**To service the machine, stop the kiosk watchdog first.** The window runs with
`--kiosk`, so `Alt+F4` is the only way out of it — and with the watchdog behind
it, the window is back within seconds. Send `stop` to port 2350, do the work,
send `start` when done. Closing the watchdog's own console window works too.

Updating the show is unchanged and still deliberate: `docker compose pull` in
`C:\becoming-many`, then let the station watchdog restart, or send it `restart`.
Nothing in this folder pulls on its own — a power-cycle must never change the
version an exhibition is running.

## Reading the logs

One rotating log per watchdog in `C:\Watchdog\logs`. The scripts prefix their
own lines, so the story of a cold start reads as `[docker-up] engine answered
after 45s`, then `[docker-up] station stack is up`, then `[wait-health] station
answered after 12s`. A restart loop shows as repeated `[poll-health] no answer
from http://localhost/health` before each bring-up.
