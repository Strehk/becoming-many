# Deployment Direction

## Current

The repository builds one station container containing the static browser
pages and a Bun server. The server exposes `/health` and `/config`; the
Conductor page hosts and controls the show in-process. Per-station values are
provided through environment variables for M5 host, optional device metadata, station
name, and port. A Windows kiosk launcher is present.

The current package can run as one independent station. It has not completed a
Futurium venue acceptance test.

## Windows branch and release deployment

Run as the signed-in station account in Windows PowerShell 5.1 or newer:

For the default `david_refactor` branch, double-click
`C:\becoming-many\scripts\deploy-branch.bat`. If the kiosk covers the desktop,
press **Win+R**, enter that same path and press Enter. The launcher opens
PowerShell, handles execution policy for this process and keeps errors visible.
There is no manual UDP command or requirement to start Watchdogs first.

```powershell
cd C:\becoming-many
.\scripts\deploy-branch.ps1 -Branch david_refactor
# Or another remote branch with the same deployment infrastructure:
.\scripts\deploy-branch.ps1 -Branch feature/my-experiment
# Return to the current published release without switching Git branches:
.\scripts\deploy-release.ps1
```

Prerequisites: a regular Git clone at this exact path, an existing untracked
`.env`, Git for Windows, Docker Desktop with Linux containers and Compose v2
supporting `up --wait`, and the installed Watchdogs/autostart described in
[watchdog/README.md](../../watchdog/README.md). This is an updater for an installed
station, not an OS, Docker, SteamVR, PICO or Watchdog installer. Keep `HOST_PORT=80`
or omit it: the installed health and kiosk configuration uses `http://localhost`.
If local execution policy blocks scripts, invoke the same entry point with
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-branch.ps1 -Branch david_refactor`.

The commands reject uncommitted changes (including untracked files) without
stashing or discarding them. Branch deployment fetches origin, checks the remote
branch and its `.env` safety, switches or creates its local tracking branch, and
pulls fast-forward only. The pull names the validated commit SHA to prevent a
concurrent remote push from substituting unchecked files. Ahead/diverged local
branches are rejected; merge or reconcile development work on the development
machine before testing on the station. No merge/rebase/reset is automated.

Test branches must contain the same deployment scripts, Watchdog files, Compose
files and `.dockerignore` as the starting checkout. Integrate this deployment
change into older branches first. This explicit check prevents a branch switch
from removing the running updater or reverting reboot behavior. Arbitrary
application changes and branch names with slashes are supported; deployment
infrastructure upgrades require a separate coordinated maintenance step.

The existing UDP controls stop kiosk and health polling before switching; their
process exit is checked. Missing Watchdog listeners are detected through Windows
UDP sockets and remain stopped. An existing listener that does not respond is
an error, not an excuse to bypass supervision. If the engine is unavailable,
the script asks the existing Docker Watchdog to start Docker, or launches the
installed Docker Desktop when no Docker Watchdog is listening. It does not
launch a second Desktop process. The engine gets five minutes to become ready.
A shared file lock excludes
concurrent deploy commands and Watchdog Compose hooks. Both paused Watchdogs
receive `start` in `finally`, including on failure; an unreachable Watchdog is
reported as a failure. SteamVR and PICO are not restarted.

When deploying with Watchdogs off, the kiosk stays closed and the summary says
so. Restart Windows and sign in afterward; the existing Startup-folder launcher
starts the full station. The script does not reboot without your action. When
Watchdogs were already active, their kiosk returns automatically after deployment.

| Mode | Image | Reboot behavior |
| --- | --- | --- |
| Default, no local state | `ghcr.io/strehk/becoming-many:latest` | Existing base Compose behavior |
| Branch | `becoming-many-local:<branch-slug>-<full-sha>` | Reuse that local image; no build, pull or release fallback |
| Explicit release deploy | Published GHCR image pinned by digest | Reuse that exact release until another explicit update |

Branch deployment uses `docker build` in the validated checkout and records the
commit as an image label. The manual `docker-compose.build.yml` override also
uses a separate local tag (`becoming-many-local:checkout`), so neither build path
can overwrite GHCR `latest`. A direct manual Compose build does not select a
persistent station deployment. Avoid plain `docker compose up` or `pull` when
managing a selected branch; use these scripts.

`.git\station-deployment.json` is a small local Compose override containing the
image, branch and commit labels. It is atomically replaced after a successful
build/pull and **before** container recreation. The previous selection is kept
as `.git\station-deployment.json.previous`. Git never versions either file;
`.env` is only checked/read and its hash is compared after the branch switch.
The Docker build context excludes `.env`, `.git` and Watchdog runtime files.
No additional package or authored application configuration is introduced.

Success requires a running container using the expected image ID, its Docker
healthcheck, HTTP 200 from `/health`, and the kiosk and poller processes when
their Watchdogs were active at entry. With Watchdogs off, only the station is
verified; kiosk acceptance follows after reboot/sign-in. The
summary prints branch, commit (or explicitly unknown for an unlabelled release),
image, container and health status. A running kiosk process is not proof of a
rendered page, working XR or a 90 Hz installation; verify those on the headset.

## Recovery

- Before image selection is written, failure leaves the previous selection in
  place. After selection/recreation starts, failure retains the new selection
  for diagnosis and reboot recovery; it does not silently deploy another image.
- Normally fix the reported cause and rerun the command, or run
  `.\scripts\deploy-release.ps1` to pull and select the stable published release.
  Release deployment also requires a clean checkout. Any running Watchdogs must respond.
- For offline recovery, stop kiosk and station polling using the UDP helper
  below. With no deployment running, copy the `.previous` state over the active
  state, then call `watchdog\bin\docker-up.bat`. The referenced old image must
  still exist locally. Start both Watchdogs again even if bring-up fails.
- A missing branch image or malformed state fails closed. Preserve the state
  for diagnosis and use release deployment to replace it; do not delete state
  as a routine workaround. Never delete `.env` or run `git clean -x`.
- After forcibly terminating PowerShell, send `start` to both paused Watchdogs
  (or sign out/reboot to run the installed startup task). The file lock releases
  on process exit; do not delete a lock file while a command is running.

```powershell
# Existing UDP controls; does not launch duplicate Watchdog instances.
. C:\becoming-many\scripts\station-deployment.ps1
Send-WatchdogCommand 2350 stop
Send-WatchdogCommand 2349 stop
# Optional offline rollback of the image selection:
Copy-Item C:\becoming-many\.git\station-deployment.json.previous `
  C:\becoming-many\.git\station-deployment.json -Force
try { & C:\becoming-many\watchdog\bin\docker-up.bat }
finally {
  Send-WatchdogCommand 2349 start
  Send-WatchdogCommand 2350 start
}
```

Before exhibition use, run a branch deployment, repeat it, reboot, verify the
same image and kiosk, then deploy release and reboot again. Exercise dirty
checkout, missing branch, failed build and unreachable engine/Watchdog cases.
Compare `.env` hashes without printing its values. Local PowerShell tests do
not replace this Windows/Docker/Watchdog acceptance.

Local verification: `pwsh -NoProfile -File tests/deployment.test.ps1` covers real
temporary Git repositories, tracked `.env` rejection, persistent selection,
exclusive locking, running/absent/partially running Watchdogs and injected
deployment/restoration failures without Docker.
These checks and `bun run lint` pass on macOS with PowerShell 7.6.4. Windows
PowerShell 5.1, actual Compose execution, UDP responses, reboot and visible
kiosk/headset behavior remain station acceptance checks.

Compose relies on the official [override merging rules](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)
and [`up --wait`](https://docs.docker.com/reference/cli/docker/compose/up/).

## Planned

Windows-PCVR over USB-C is confirmed. Standalone PICO belongs to a later separate
project; no alternative standalone path is planned here.

The intended installation consists of two identical independent stations. Each
has an ICAROS rig, its own M5StickS3, a station PC, a local operator display,
and a PICO 4 Enterprise headset. Stations share network infrastructure but no
show state or central runtime service.

Local station identity and hardware binding remain local deployment facts. A
failure at one station must not stop the other.

## Open

- Exact station PC, headset edition, OS, browser/runtime, streaming-client, and
  driver versions.
- Venue network behavior, including client isolation and stable addressing.
- Recovery procedure and acceptance results for repeated sessions.

These are evidence tasks, not reasons to add a generic coordination service.
## Startup and streaming diagnostics (#116)

Double-click `C:\becoming-many\scripts\find-problems.bat`. No Bash installation
or typed PowerShell command is needed. Photograph the summary or send
`watchdog/logs/find-problems.txt`. It records TCP 49667 owners and their services,
Watchdog UDP endpoints, port exclusions, process paths, startup entries/tasks,
Git revision, Docker state and recent supervisor logs. PID numbers can change
between runs. A dual-stack listener is counted once per owner. No automatic
repair or process termination is performed.

Repeated/concurrent startup is guarded by the existing launcher, with explicit
messages for outside owners and port conflicts. The fixed installation path also
supports the existing Startup symlink. A failed startup collects diagnostics.
An existing externally started application is retained but not claimed as
supervised. Check PICO's own connection status; process/port readiness is not
headset readiness.

The first update from the old startup wrapper changes a protected Watchdog file.
The older `deploy-branch.bat` intentionally rejects such infrastructure changes.
Perform an explicit clean fast-forward of `david_refactor` before running the
branch deployment again; do not bypass the guard or force-reset local work.
Diagnostic files can be copied and run separately before that update, using
`-StationRoot C:\becoming-many` when launched outside the checkout.

Official PICO 2.1 documentation lists PC 2.1.2 with HMD 2.1.1. Verify the selected
SteamVR streaming mode and the headset's fixed PC association separately for
each Ikaros. The native SDK can query real connection state but is not integrated
by these scripts. The unresolved port collision and physical cold-boot/reconnect
acceptance are tracked in [#116](https://github.com/Strehk/becoming-many/issues/116).
See [PICO documentation](https://business.picoxr.com/de/doc/43j3qcoq) and
[PICO SDK](https://business.picoxr.com/jp/doc/BusinessStreamingv2SDK).
