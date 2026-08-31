/**
 * Purpose: Serve the existing production build for the duration of a benchmark.
 * Context: A run measures the built application, not the dev server.
 * Responsibility: Start vite preview, report readiness, and stop it completely.
 * Boundary: Browser driving and reporting stay outside.
 */

import { spawn } from "node:child_process";

export const PREVIEW_PORT = 4173;

const SERVER_READY_TIMEOUT_MILLISECONDS = 60_000;

export function startPreviewServer(): Promise<() => void> {
  // Detached so the whole group can be killed: `bunx` spawns vite as a child,
  // and killing only the wrapper leaves the port bound for the next run.
  const server = spawn(
    "bunx",
    ["vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"],
    { detached: true, stdio: ["ignore", "pipe", "inherit"] },
  );

  const stopServer = (): void => {
    if (server.pid === undefined) return;
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill();
    }
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      stopServer();
      reject(
        new Error("vite preview did not start; run `bun run build` first"),
      );
    }, SERVER_READY_TIMEOUT_MILLISECONDS);

    server.stdout.on("data", (chunk: Buffer) => {
      if (!chunk.toString().includes(String(PREVIEW_PORT))) return;
      clearTimeout(timeout);
      resolve(stopServer);
    });
  });
}
