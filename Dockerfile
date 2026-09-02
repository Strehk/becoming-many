# Purpose: Build the pages and run one station in one container.
# Context: docker-compose.yml starts this on a station PC; the single Bun
#   process serves dist/ and the deployment config (station/README.md).
# Responsibility: Reproduce `bun run build`, then carry only what the runtime
#   needs: the built pages and the TypeScript the server runs directly.
# Boundary: Per-station facts (M5 host, name) arrive as env vars at run time,
#   never at build time — one image serves every station.

FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# Typecheck and bundle, exactly the gate a local `bun run build` runs.
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Bun executes the server's TypeScript directly; it imports only from
# station/ and src/, so no node_modules ships.
COPY station ./station
COPY src ./src
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 7823

# Liveness only: an unreachable M5 or a closed window must not restart the
# station. /health answering means the process serves.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "-e", "fetch(`http://localhost:${process.env.PORT || 7823}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["bun", "station/station-server.ts"]
