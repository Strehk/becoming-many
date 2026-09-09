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

After each kiosk launch, `kiosk.yaml` runs
[bin/keep-kiosk-on-top.ps1](bin/keep-kiosk-on-top.ps1). The helper waits for
the uniquely titled conductor window and gives it Windows topmost Z-order,
placing it above the windows already opened by PICO and SteamVR. It does not
activate the window or interfere with keyboard focus.

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

Keep the repository at `C:\becoming-many` and run the tracked configs and
scripts directly from its `watchdog` folder. A symbolic link supplies the
installed Artcom Watchdog v0.3.0 binary under the name the startup script
expects; another puts the tracked startup script in the station user's Startup
folder. No copied config directory or `C:\Watchdog` junction is needed.

Install Watchdog at `C:\Program Files\Watchdog`, then run these commands from an
elevated PowerShell window:

```powershell
New-Item -ItemType SymbolicLink `
  -Path 'C:\becoming-many\watchdog\Watchdog.exe' `
  -Target 'C:\Program Files\Watchdog\bin\Watchdog.exe'

# Start the station when the current station user signs in.
$startupFolder = [Environment]::GetFolderPath(
  [Environment+SpecialFolder]::Startup
)
New-Item -ItemType SymbolicLink `
  -Path (Join-Path $startupFolder 'start-station.bat') `
  -Target 'C:\becoming-many\watchdog\start-station.bat'
```

Creating the symbolic link requires an elevated shell unless Windows Developer
Mode is enabled. Run the commands as the station account that will sign in,
because the Startup folder is per user. Each link path must be absent before its
command runs. If Watchdog was installed elsewhere, adjust the target of the
`Watchdog.exe` link. Open `shell:startup` from the Run dialog to inspect the
resulting startup link.

The resulting paths are:

```text
C:\becoming-many\
  docker-compose.yml
  .env
  watchdog\
    Watchdog.exe                     link to the installed binary
    start-station.bat
    docker.yaml  station.yaml  steamvr.yaml  pico.yaml  kiosk.yaml
    bin\  docker-up.bat  poll-health.bat  wait-health.bat
          keep-kiosk-on-top.ps1
    logs\   created on first start
    run\    heartbeat file and the kiosk browser profile
<current user's Startup folder>\
  start-station.bat                  link to the tracked startup script
```

`Watchdog.exe`, `logs\`, and `run\` are ignored by Git. The configs carry the
fixed checkout path. If the repository moves, update the paths in the `.yaml`
files and `bin\poll-health.bat`, update `PROJECT_DIR` at the top of
`bin\docker-up.bat`, and recreate the startup link. If the Watchdog install
moves, recreate the executable link.

Then:

1. **Turn off Docker Desktop's "Start Docker Desktop when you sign in."**
   `docker.yaml` owns that process. Two owners fight over it, and the loser is
   whichever one launches second.
2. Set a power plan that never sleeps and never blanks the display.
3. Check the two installed paths in `docker.yaml` and `kiosk.yaml` against the
   machine — Chrome in particular is also found at `Program Files (x86)` and
   under `%LOCALAPPDATA%`.
4. Check that `shell:startup` contains the `start-station.bat` symbolic link, so
   signing in after a power-on brings the station up.

`start-station.bat` delegates to `scripts/start-station.ps1` using the fixed
installation path, including when invoked through the documented Startup symlink.
A file lock prevents concurrent launchers. Existing Watchdogs are identified by
config path; unknown control-port owners stop startup with a diagnostic. Already
running external applications are retained with an explicit unsupervised warning.
No process is killed or port reserved. Docker and PICO start before SteamVR
(30 seconds), then the kiosk (15 seconds). New Watchdogs have a bounded control-port
readiness check. These checks do not establish headset connectivity.

Remove an obsolete `C:\Watchdog` startup shortcut if the installation has migrated
to the tracked checkout; retain exactly one station startup entry. The diagnostic
script inventories both startup folders, relevant scheduled tasks and process
command lines to identify competing owners before changing anything.

On failure the BAT wrapper runs `scripts/find-problems.ps1 -NoOpen` and keeps the
window open. The latest startup transcript is `watchdog/logs/startup.log`.
Double-click `scripts/find-problems.bat` for a fresh photographable summary and
Notepad report at `watchdog/logs/find-problems.txt`. This one-shot collector does
not stop applications or modify network settings. Reports overwrite the prior
report, remain ignored by Git and include partial failures rather than aborting
at the first missing privilege or unavailable tool.

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

Update deliberately with `scripts\deploy-branch.ps1 -Branch david_refactor` or
`scripts\deploy-release.ps1` from `C:\becoming-many`. These commands pause the
kiosk and health poller through their existing UDP controls, then restore both.
Watchdogs that are not listening remain off; deployment starts Docker Desktop
if needed and leaves the kiosk closed until the next Windows sign-in. For a
single-action deployment of `david_refactor`, double-click
`scripts\deploy-branch.bat` or launch its full path through Win+R.
Docker Desktop, SteamVR and PICO supervision remain active. The Compose hook
shares a file lock with deployment, so concurrent hooks skip their bring-up.
The local `.git\station-deployment.json` selects the image across restarts;
without it, the base Compose file continues to select the release. Branch mode
never builds or pulls during boot and never falls back to GHCR when its image
is missing. See [deployment and recovery](../docs/direction/deployment.md).

## Reading the logs

One rotating log per watchdog in `C:\becoming-many\watchdog\logs`. Docker Compose
reports container startup; the kiosk readiness helper reports
`[wait-health] station answered after 12s`. A restart loop shows as repeated
`[poll-health] no answer from http://localhost/health` before each bring-up.
