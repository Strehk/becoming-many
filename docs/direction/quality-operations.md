# Quality and Operations Direction

## Current

Local engineering gates are separate commands: `bun test`, `bun run check`,
`bun run lint`, `bun run build`, and `bunx fallow`. The release-image workflow
builds and publishes Docker images when a GitHub release is published. There is
no current pull-request CI workflow that runs the complete local gate set.

The deterministic benchmark guards accepted renderer counters and records
machine-specific frame measurements. It is not a headset or station acceptance
test.

## Planned Evidence

Every hardware or station result must record:

- repository revision and built artifact;
- headset model/edition, OS, browser or streaming client, and refresh rate;
- station CPU/GPU, driver, XR runtime, and cable/transport when relevant;
- exact route or session sequence and duration;
- frame timing, reconnect/recovery observations, and resource growth.

A station acceptance run should repeatedly cycle real visitor sessions, include
M5 and headset disconnect/reconnect, verify restart without code or terminal
intervention, and confirm resource counts return to a stable range.

## Open

- Final standalone-versus-PCVR profile and budgets.
- Whether PR CI is worth adding for the existing static gates.
- Automated firmware artifact production and version matching.
- Exact soak duration and venue sign-off procedure.

Do not add a runtime quality governor before device measurements show a
repeatable need and define which fixed capacities may safely change.
