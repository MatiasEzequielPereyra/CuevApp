import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { manifest, projectRoot, verifySources } from "../scripts/verify-sources.mjs";

test("the four supplied sources retain their exact bytes and hashes", () => {
  assert.equal(verifySources().length, 4);
});

test("authored Markdown links resolve inside this repository", () => {
  const originalPaths = new Set(manifest.map(({ path }) => resolve(projectRoot, path)));
  let links = 0;
  function walk(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md") && !originalPaths.has(path)) check(path);
    }
  }
  function check(path) {
    const markdown = readFileSync(path, "utf8");
    for (const [, target] of markdown.matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^(https?:|#)/.test(target)) continue;
      const destination = resolve(dirname(path), decodeURIComponent(target.split("#")[0]));
      assert.ok(existsSync(destination), `${path}: missing ${target}`);
      links++;
    }
  }
  check(resolve(projectRoot, "README.md"));
  walk(resolve(projectRoot, "docs"));
  assert.ok(links >= 10, "documentation should link its sources and evidence");
});
