import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const UI = join(ROOT, "src/ui");
const PAGES = ["index", "test", "conductor", "flash"];

test("browser entries declare their structure, stylesheet and module in UI", () => {
  for (const page of PAGES) {
    expect(existsSync(join(ROOT, `${page}.html`))).toBe(false);
    const html = readFileSync(join(UI, `${page}.html`), "utf8");
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain('href="./app.css"');
    expect(html).toContain('type="module"');
    expect(html).toContain("/entry/");
  }
});

test("UI and Entry bind declared markup without parsing or constructing it", async () => {
  const forbidden =
    /\b(?:innerHTML|outerHTML|insertAdjacentHTML|DOMParser|createElementNS|createElement)\b|\bdocument\.write\s*\(/;
  for (const folder of ["src/ui", "src/entry"]) {
    for await (const name of new Bun.Glob("**/*.ts").scan(join(ROOT, folder))) {
      const source = readFileSync(join(ROOT, folder, name), "utf8");
      expect(source, `${folder}/${name}`).not.toMatch(forbidden);
    }
  }
});

test("Station consumes shared contracts without importing browser source", async () => {
  for await (const name of new Bun.Glob("**/*.ts").scan(
    join(ROOT, "station"),
  )) {
    const source = readFileSync(join(ROOT, "station", name), "utf8");
    expect(source, name).not.toMatch(
      /(?:from|import)\s*\(?\s*["'][^"']*\/src\//,
    );
  }
});
