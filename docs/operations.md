# Operations

This is the verified operational entry point for the current station package.
Issue [#54](https://github.com/Strehk/becoming-many/issues/54) owns the complete
two-station installation and troubleshooting runbook; missing inventory is not
silently guessed here.

## Safety-critical USB restriction

**Use the front USB port for the headset. Do not use the rear USB-C port next to
the Ethernet connector on the installation PCs.**

The reported rear-port connection can switch the PC off and supplies no headset
signal. The front connection has run successfully. Label the prohibited port and
do not reproduce the shutdown as routine diagnosis. The exact electrical or
hardware cause remains unknown.

## Runtime ownership

Each station is independent. The Bun station server serves `dist/`, `/health`,
and `/config`; the Conductor page owns its in-browser show. Station carries no
Show clock, visitor state, or transport command. Per-station values come from an
untracked `.env`; secrets are never committed or printed.

The exact server contract and Docker modes are documented beside their owner in
[station/README.md](../station/README.md). Watchdog processes and recovery
commands are documented in [watchdog/README.md](../watchdog/README.md). Kiosk
flags and limitations live in [KIOSK.md](../KIOSK.md).

## Development and local station

```sh
bun install
bun run dev
```

For the built station path:

```sh
bun run build
cp .env.example .env
docker compose up -d
```

Development uses Vite. Station testing uses the built Bun/Docker path. A healthy
`/health` response proves only the serving process, not a rendered page, working
XR, audio, M5 input, or 90-Hz delivery.

## Windows deployment

The installed station root is `C:\becoming-many`. For the refactor branch, run
the existing launcher as the signed-in station account:

```powershell
C:\becoming-many\scripts\deploy-branch.bat
```

The underlying PowerShell path validates a clean checkout, fetches the selected
remote commit, builds a distinct local image, records the selection, recreates
the container, and resumes the existing Watchdogs. It never stashes, resets,
merges, force-pushes, or overwrites `.env`.

Return to the published release through the dedicated script:

```powershell
cd C:\becoming-many
.\scripts\deploy-release.ps1
```

Do not use plain `docker compose pull` or `up` to change an installation whose
image selection is managed by these scripts.

## Diagnosis and recovery

Run the read-only problem collector first:

```powershell
C:\becoming-many\scripts\find-problems.bat
```

Preserve `watchdog\logs\find-problems.txt`, the visible symptom, station name,
time, active revision/image, headset connection, M5 host, and cable/port before
repair. PID numbers alone are not stable evidence.

Issue [#116](https://github.com/Strehk/becoming-many/issues/116) owns the observed
PICO/EventLog TCP 49667 conflict. Use `repair-pico-port.bat` only when current
diagnostics identify that exact collision. It changes system-wide dynamic TCP
ranges and requires an administrator prompt and restart; it is not a generic
streaming fix. Do not rerun it on a working installation.

For ordinary deployment failure, fix the reported cause and rerun the same
deployment, or select the released image with `deploy-release.ps1`. Never delete
`.env`, deployment state, or Git data as routine recovery. After a forced script
termination, resume both Watchdogs or reboot/sign in so the installed startup
path runs.

## Open installation evidence

The repository does not yet contain the exact two-station hardware/software
matrix, verified PICO/OpenXR configuration, port/cable inventory, repeated cold
starts, reconnect cycles, fresh-visitor flow, or complete 90-Hz evidence. Record
those results in #42/#54/#116 rather than appending dated sections here.

Standalone PICO is outside this project. Do not add a second deployment path,
browser shell bridge, or automatic operating-system repair without a demonstrated
installation requirement.
