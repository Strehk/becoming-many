# Becoming Many

**A speculative VR experience about collective perception, ecological
entanglement, and how reality comes into being.**

The visitor flies through a world that begins white and almost empty. The
sensory systems of other living beings appear one by one: scent, echolocation,
motion perception, thermal perception, magnetoreception, and finally the
relationships connecting the world.

The senses layer rather than replace one another. The world grows denser until
the accumulated signals become deliberate overload, then returns to White
World. The closing emptiness is visually similar to the opening but has a
different meaning after everything that was revealed.

The authored show currently lasts 8 minutes 41 seconds and combines the visual
world with synchronized English or German narration. The authoritative wording
lives in `script/en.md` and `script/de.md`.

## Status

The core browser/WebXR experience is largely implemented: the complete
narrative sequence, streamed landscape, perception layers, flight, narration,
M5 tilt input, deterministic benchmarking, and a conductor page all run from
the current source.

The project is now in stabilization and refinement. Active work is limited to
measured performance improvements, reliability, code cleanup, issue fixes, and
small issue-backed product additions. Physical PICO 4 performance and PCVR
acceptance are still open; desktop evidence does not close those gates.

[Project documentation](docs/README.md) records the current implementation,
remaining work, and installation direction.

Background material:
[Notion — Becoming Many](https://futurerealiteslab.notion.site/Becoming-Many-34b29d8a9fe280ceb963f133aa2689ee)

## Development

```sh
bun install
bun run dev
```

The bare page at `/` runs the complete show.
Starting `bun run dev` opens this page automatically in the default browser;
use the URL Vite prints when its default port is already occupied.
Use `?level=<name>` or `/<name>` for a showless level, and
`?benchmark[=<profile>]` for a deterministic route. See
[AGENTS.md](AGENTS.md) for conventions and verification commands.

## Running a Station

```sh
cp .env.example .env
docker compose up -d
```

The station window is `/conductor.html`; `/` remains the bare rehearsal page.
The container serves the built pages plus `/config` and `/health`. See
[station/README.md](station/README.md) for environment variables, local builds,
the M5 simulator, and deployment details.

## Performance

Performance is tracked in [docs/performance.md](docs/performance.md). The target
is stable 90 Hz on a physical PICO 4. The deterministic benchmark and dated
desktop reports are regression evidence only; no current headset acceptance is
recorded.

## License

[CC BY 4.0](LICENSE) — © 2026 Tade Strehk, Erasmus Schmidt, Eddie Huesmann.
Reuse and adapt freely, with attribution.
