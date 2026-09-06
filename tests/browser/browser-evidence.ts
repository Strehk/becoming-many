/**
 * Purpose: Collect the same browser failures and run identity across local checks.
 * Context: Smoke, deterministic replay, and show observation need comparable facts.
 * Responsibility: Observe errors, read the existing WebGL context, and identify inputs.
 * Boundary: No browser launch, test orchestration, extra renderer, or timing instrumentation.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import type { Page } from "playwright";

/** Refuse artifact writes outside the protected refactor branch. */
export function assertRefactorBranch(): void {
  if (gitText("branch", "--show-current") !== "david_refactor") {
    throw new Error("Stop: the working branch must be david_refactor");
  }
}

/** Attach before navigation; callers inspect failures before closing the context. */
export function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (message: string): void => {
    if (errors.length < 100) errors.push(message);
    else if (errors.length === 100)
      errors.push("Further browser errors omitted after 100 entries");
  };
  page.on("pageerror", (error) => record(`pageerror: ${error.message}`));
  page.on("crash", () => record("Browser page crashed"));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      /context (?:was )?lost|GL_INVALID|VALIDATE_STATUS.*false|Unknown level/i.test(
        message.text(),
      )
    )
      record(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      record(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on("requestfailed", (request) =>
    record(`request: ${request.url()}: ${request.failure()?.errorText}`),
  );
  return errors;
}

/** Read the application's context. Calling getContext on this canvas reuses it. */
export async function readRenderingInfo(page: Page): Promise<{
  vendor: string;
  renderer: string;
  softwareRendering: boolean | null;
}> {
  return page.evaluate(() => {
    const unavailable = {
      vendor: "unavailable",
      renderer: "unavailable",
      softwareRendering: null,
    };
    const canvas = document.querySelector("canvas");
    if (!canvas) return unavailable;
    const gl = canvas.getContext("webgl2");
    if (!gl) return unavailable;
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    if (!extension)
      return {
        vendor: String(gl.getParameter(gl.VENDOR)),
        renderer: String(gl.getParameter(gl.RENDERER)),
        softwareRendering: null,
      };
    const renderer = String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL));
    return {
      vendor: String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)),
      renderer,
      softwareRendering: /swiftshader|llvmpipe|software/i.test(renderer),
    };
  });
}

/** SHA-256 includes paths and bytes, so a dirty source tree has a stable identity. */
export function readRunIdentity() {
  const sourceFiles = gitFileList(
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "src",
    "public",
    "station",
    "package.json",
    "bun.lock",
    "vite.config.ts",
    "tsconfig.json",
  );
  const untrackedFiles = gitFileList("--others", "--exclude-standard");
  return {
    revision: gitText("rev-parse", "HEAD"),
    sourceDigest: hashRepositoryFiles(sourceFiles),
    diffDigest: hashRepositoryFiles(
      untrackedFiles,
      execFileSync("git", ["diff", "--binary", "HEAD"]),
    ),
    dirtyFiles: gitText("status", "--short").split("\n").filter(Boolean),
    platform: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model ?? "unavailable",
    bunVersion: Bun.version,
  };
}

function gitText(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitFileList(...args: string[]): string[] {
  return gitText("ls-files", "-z", ...args)
    .split("\0")
    .filter(Boolean)
    .sort();
}

function hashRepositoryFiles(
  files: readonly string[],
  initial: Uint8Array | string = "",
): string {
  const hash = createHash("sha256").update(initial);
  for (const file of files) {
    hash.update(file).update("\0");
    hash.update(existsSync(file) ? readFileSync(file) : "deleted").update("\0");
  }
  return hash.digest("hex");
}
