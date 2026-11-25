import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("branch cleanup uses a server-side lease and rejects a concurrent push, offline", () => {
  const result = spawnSync("pwsh", ["-NoProfile", "-File", "tests/prune-merged-branches.test.ps1"], {
    encoding: "utf8", windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal((result.stdout.match(/PASS /g) ?? []).length, 11, result.stdout);
});
