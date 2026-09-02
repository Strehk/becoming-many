# Becoming Many

**A speculative VR experience about collective perception, ecological entanglement, and the
question of how reality comes into being at all.**

You fly as a glider through a world that is, at first, white and almost empty. Nothing has form
yet. Step by step you gain the sensory systems of other living beings — echolocation, motion
vision, ultraviolet reflection, thermal sight, chemical perception, magnetoreception, the
network sense of a swarm — and with each one, more of the world becomes perceptible.

The senses are **layered, not swapped**. Nothing is ever taken away to make room for the next
thing; the world only ever grows denser. That is the argument of the piece: what you call "the
world" is not a place you look at but the sum of the senses you happen to have. Add a sense and
the world was always already like that — you simply could not perceive it.

The experience runs in three phases across roughly five minutes:

1. **Discovery** — the white void, then the first senses. Each new layer is a revelation.
2. **Realisation** — the layers begin to interact. The world is no longer one world but many
   overlapping ones, all equally real.
3. **Overload** — deliberately too much. Every sense at once is not richer perception, it is
   noise. The layers are then stripped away one by one, until nothing remains but the wind.

Around the visuals there is a voiceover and a sound layer that grows with the senses: every
perceptual layer has its own sonic counterpart, so the accumulation is heard as much as seen.

The ending matters as much as the build-up. Being able to perceive everything is not the goal —
the piece ends in the emptiness it started from, but the emptiness is no longer the same
emptiness.

---

## Status

The concept, storyboard, and script are settled. The code in `src/` and `public/` is a
working landscape MVP — a Three.js/WebXR world with streamed terrain, instanced
vegetation, animals, and the first sense modules. [docs/README.md](docs/README.md) is the
documentation index: current status, architecture, standards, roadmap, and the
[installation direction](docs/direction/README.md). Nothing in this repo is stable yet.

Background, concept, storyboard and script:
[Notion — Becoming Many](https://futurerealiteslab.notion.site/Becoming-Many-34b29d8a9fe280ceb963f133aa2689ee)

## Running a station

The whole deployed station is one Docker container — pages, WebSocket broker,
health endpoint:

```sh
cp .env.example .env        # optional: M5 host, device id, station name
docker compose up -d        # pulls the released image from GHCR
```

Show page at [http://localhost](http://localhost), operator page at
[http://localhost/conductor.html](http://localhost/conductor.html).
`docker compose pull` updates to the newest release; building from the
checkout instead is `docker compose -f docker-compose.yml -f
docker-compose.build.yml up -d --build`. Details, endpoints, and the env
vars: [station/README.md](station/README.md); opening both pages without
browser UI around them: [KIOSK.md](KIOSK.md).

For development: `bun install`, then `bun run dev` (pages) beside
`bun run station` (broker) — see [AGENTS.md](AGENTS.md) for the full toolchain.

## Performance Map — `terrain-finetuning` (PR #2)

The project is measured at 16.1 ms mean / 26.4 ms p95 against an 11.11 ms
90 Hz budget ([2026-08-24 audit](docs/performance-audit-2026-08-24.md)), so
this branch's performance-relevant commits are mapped here for adaptation or
rollback. Each row is the commit to revert or retune if measurement says so;
none of them have been measured individually yet. `bun run benchmark`
(from main) is the instrument.

### Gains

| Commit | Change | Weight |
| --- | --- | --- |
| `e4e701e` | Grass range becomes a 64 m module constant instead of the level view distance | Resident grass window 9×9 → 5×5 chunks; 985,608 → 304,200 triangles (the audit's P1 fix). The same commit adds the sense hook to the grass shaders — the gain survives reverting the hook, they are separable |
| `edaf88b` | Grass parked out of every narrative level (config only) | Removes all grass triangles and the grass × thermal pairing until its fragment cost is measured; restoring is one line in `echo.level.ts` |
| `53a9749` (with `69fd09e`, `6ab9fbf`) | Scent layer retune | Net 18,816 → 17,640 buffered points, still one draw call |

### Costs

| Commit | Change | Weight |
| --- | --- | --- |
| `a26f8c1` | Multi-octave value-noise warmth field, sampled **per fragment** in the thermal fragment shader | The dominant new GPU cost: 4 octaves × 8 hashes = 32 hash evaluations per sensed fragment inside the 35 m radius, on ground, plants, rocks, and animals. Levers before revert: octave count, distance cutoff, or baking to a texture |
| `7cfbd72` | Per-fragment radiated-heat loop over up to 4 body segments (`exp` falloff) | Runs on every sensed surface fragment — including animals, where its result is multiplied by zero |
| `ffe0f41`, `b5a6249` | Per-surface contrast curve and warmth bands | Small per-fragment ALU additions; retune targets, unlikely revert targets |
| `ec3d08d` | Vegetation 8 → 19 variants (birch and dead trees join `variantsByZone`) | ~6.9 MB added startup transfer (the GLBs were already in the repo but unfetched), ~+4 MB CPU+GPU pool memory (capacity is reserved per variant), and 15 → ~35 resident `InstancedMesh` binds per frame. Per-instance triangles go **down**; the cost is transfer, memory, and binds |
| `6903fcf` | Air particles 192 → 270 per chunk (~+41%) | ~82 k points vs 58 k; the audit found air particles cost-neutral at the old density, unverified at this one |
| `69fd09e` | Scent scatter draws two randoms per axis (triangular falloff) | CPU-only, in the stream queue: ~2× hash work per recycled scent chunk; the queue peaked at 243/256 in the audit soak |
| `ba1660e` + `d45d425` | Thermal radius 30 → 60 → 35 m | Net +5 m sensed radius; more fragments pay the full thermal path |

The world-surface retunes (`8ca5a22`, `5b16a8c`, `37f51ec`, `551ee3d`) change
the height field's shape, not its geometry budget — terrain stays a fixed
grid — and are performance-neutral.

## License

[CC BY 4.0](LICENSE) — © 2026 Tade Strehk, Erasmus Schmidt, Eddie Huesmann.
Reuse and adapt freely, with attribution.
