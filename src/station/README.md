<!--
Purpose: Document ownership of the deployment-config contract.
Context: The station server passes deployment facts to the pages it serves.
Responsibility: Explain what belongs in src/station.
Boundary: The server lives in station/; the operator UI lives in src/conductor.
-->

# Station

This folder owns the browser side of what a station **deployment** states:
which facts a station server was started with, and how a page reads them. It
holds no show state, knows no schedule, and never decides what a fact means.

`deployment-config.ts` is the contract: `loadDeploymentConfig()` fetches
`/config` and fails soft to `{}` when nothing answers, and
`parseDeploymentConfig` treats the payload as untrusted — blank values read as
"not configured" rather than as empty-string facts. A set fact is deployment
authority: the page applies it and the matching conductor control renders
read-only.

`station-settings.ts` holds the server's default port, importable by both the
Bun server (`station/station-server.ts`) and the Vite dev proxy
(`vite.config.ts`), so one number rules everywhere.

The server itself is not here. It runs under Bun rather than in a browser, so
it lives at [`station/`](../../station/README.md) beside `tests/` and `script/`,
and imports this folder the way the benchmark runner imports `src/benchmark`.

The Conductor hosts the show in-process and commands it through one typed
actions contract. No station protocol, broker, command bus, or remote show
transport exists in this folder.
