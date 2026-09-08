import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const UI = join(ROOT, "src/ui");
const PAGES = ["index", "conductor", "flash"];

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

test("authored browser markup stays in UI and rendering canvases stay off-document", async () => {
  const parsing =
    /\b(?:innerHTML|outerHTML|insertAdjacentHTML|DOMParser)\b|\bdocument\.write\s*\(/;
  const construction = /\b(?:createElementNS|createElement)\b/;
  for (const folder of ["src", "shared", "station"]) {
    for await (const name of new Bun.Glob("**/*.ts").scan(join(ROOT, folder))) {
      const source = readFileSync(join(ROOT, folder, name), "utf8");
      expect(source, `${folder}/${name}`).not.toMatch(parsing);
      if (
        folder === "src" &&
        name === "modules/end-credits/end-credits-texture.ts"
      ) {
        expect(source.match(construction)?.[0]).toBe("createElement");
        expect(source).toContain('document.createElement("canvas")');
        expect(source).not.toMatch(
          /\b(?:append|appendChild|replaceChildren|insertBefore)\s*\(/,
        );
      } else expect(source, `${folder}/${name}`).not.toMatch(construction);
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
