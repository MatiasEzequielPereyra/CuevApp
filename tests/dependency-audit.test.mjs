import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAudit, exception } from "../scripts/verify-dependencies.mjs";

const now = new Date("2026-11-18T12:00:00Z");
const paths = ["node_modules/picomatch", "node_modules/tinyglobby/node_modules/picomatch"];
function fixture() {
  const report = {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
    vulnerabilities: { picomatch: {
      name: "picomatch", severity: "high", isDirect: false, nodes: [...paths],
      via: [{ name: "picomatch", dependency: "picomatch", severity: "high", url: exception.advisory }],
    } },
  };
  const lock = { packages: Object.fromEntries(paths.map((path, index) => [path, { dev: true, version: exception.versions[index] }])) };
  return { report, lock };
}
function evaluate(change, date = now) {
  const { report, lock } = fixture();
  change?.(report, lock);
  return evaluateAudit(report, lock, date);
}
function addDependent(report, lock) {
  report.vulnerabilities.tool = { name: "tool", severity: "high", nodes: ["node_modules/tool"], via: ["picomatch"] };
  report.metadata.vulnerabilities.high++;
  lock.packages["node_modules/tool"] = { dev: true, version: "1.0.0" };
}

test("a clean audit passes even after the exception expires", () => {
  const result = evaluate(report => {
    report.vulnerabilities = {};
    report.metadata.vulnerabilities.high = 0;
  }, new Date("2026-11-26T00:00:00Z"));
  assert.equal(result.result, "PASS");
  assert.equal(result.advisory, undefined);
});
test("the two pinned indirect dev copies are explicitly accepted as risk", () => {
  assert.deepEqual(evaluate(), {
    result: "ACCEPTED_RISK", counts: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
    acceptedPackages: ["picomatch"], advisory: exception.advisory, expiresAt: exception.expiresAt,
  });
});
test("a dev dependent can inherit only the accepted cause", () => {
  assert.deepEqual(evaluate(addDependent).acceptedPackages, ["picomatch", "tool"]);
});
for (const [name, change] of [
  ["another advisory on picomatch", r => r.vulnerabilities.picomatch.via.push({ name: "picomatch", url: "https://github.com/advisories/GHSA-other", severity: "high" })],
  ["another advisory on a dependent", (r, l) => { addDependent(r, l); r.vulnerabilities.tool.via.push({ name: "tool", url: "https://github.com/advisories/GHSA-other", severity: "high" }); }],
  ["a production root", (r, l) => { l.packages[paths[0]].dev = false; }],
  ["a production dependent", (r, l) => { addDependent(r, l); l.packages["node_modules/tool"].dev = false; }],
  ["a direct picomatch dependency", r => { r.vulnerabilities.picomatch.isDirect = true; }],
  ["a different locked version", (r, l) => { l.packages[paths[0]].version = "4.0.8"; }],
  ["a critical finding", r => { r.vulnerabilities.picomatch.severity = "critical"; r.metadata.vulnerabilities.high = 0; r.metadata.vulnerabilities.critical = 1; }],
  ["a missing node", (r, l) => { delete l.packages[paths[0]]; }],
  ["a node belonging to another package", (r, l) => { l.packages["node_modules/other"] = { dev: true, version: "4.0.7" }; r.vulnerabilities.picomatch.nodes = ["node_modules/other"]; }],
  ["empty nodes", r => { r.vulnerabilities.picomatch.nodes = []; }],
  ["a missing cause", r => { r.vulnerabilities.picomatch.via = ["absent"]; }],
  ["empty causes", r => { r.vulnerabilities.picomatch.via = []; }],
  ["a cycle", (r, l) => { addDependent(r, l); r.vulnerabilities.picomatch.via = ["tool"]; }],
  ["a registry error", r => { r.error = { code: "E503" }; }],
  ["an unknown report format", r => { r.auditReportVersion = 3; }],
  ["invalid inventory", r => { r.vulnerabilities = null; }],
  ["an invalid count", r => { r.metadata.vulnerabilities.high = 0; }],
  ["an unknown severity", r => { r.vulnerabilities.picomatch.severity = "unknown"; }],
]) {
  test(`rejects ${name}`, () => assert.throws(() => evaluate(change)));
}
test("the exception expires without a clock override", () => {
  assert.throws(() => evaluate(undefined, new Date("2026-11-26T00:00:00Z")), /expired/);
  assert.equal(evaluate(undefined, new Date(exception.expiresAt)).result, "ACCEPTED_RISK");
});
test("rejects an invalid clock", () => {
  assert.throws(() => evaluate(undefined, new Date("invalid")), /clock/);
});
