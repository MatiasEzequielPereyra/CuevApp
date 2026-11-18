import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const exception = Object.freeze({
  advisory: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
  expiresAt: "2026-11-25T23:59:59Z",
  versions: ["2.3.2", "4.0.7"],
});
const severities = ["info", "low", "moderate", "high", "critical"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function evaluateAudit(report, lock, now = new Date()) {
  assert.ok(object(report) && !report.error && report.auditReportVersion === 2, "Invalid npm audit report");
  assert.ok(object(report.vulnerabilities) && object(report.metadata?.vulnerabilities), "Missing vulnerability inventory");
  assert.ok(object(lock?.packages), "Missing lockfile packages");
  const findings = Object.entries(report.vulnerabilities);
  for (const severity of severities) {
    assert.ok(Number.isInteger(report.metadata.vulnerabilities[severity]) && report.metadata.vulnerabilities[severity] >= 0, "Invalid audit counts");
    assert.equal(report.metadata.vulnerabilities[severity], findings.filter(([, finding]) => finding?.severity === severity).length, "Audit count mismatch");
  }
  for (const [name, finding] of findings) {
    assert.ok(object(finding) && finding.name === name && severities.includes(finding.severity), `Invalid finding: ${name}`);
  }

  function accepted(name, ancestors = new Set()) {
    assert.ok(!ancestors.has(name), `Cyclic audit cause: ${name}`);
    const finding = report.vulnerabilities[name];
    assert.ok(object(finding) && finding.severity !== "critical", `Unaccepted cause: ${name}`);
    assert.ok(Array.isArray(finding.nodes) && finding.nodes.length > 0, `Missing package nodes: ${name}`);
    for (const node of finding.nodes) {
      assert.ok(typeof node === "string" && lock.packages[node]?.dev === true, `Non-development or missing package: ${name}`);
      assert.ok(node === `node_modules/${name}` || node.endsWith(`/node_modules/${name}`), `Mismatched package node: ${name}`);
      if (name === "picomatch") {
        assert.ok(exception.versions.includes(lock.packages[node].version), "Unaccepted picomatch version");
      }
    }
    assert.ok(Array.isArray(finding.via) && finding.via.length > 0, `Missing audit cause: ${name}`);
    const next = new Set([...ancestors, name]);
    for (const cause of finding.via) {
      if (typeof cause === "string") accepted(cause, next);
      else {
        assert.ok(name === "picomatch" && finding.isDirect === false && finding.severity === "high"
          && object(cause) && cause.url === exception.advisory && cause.name === "picomatch"
          && cause.dependency === "picomatch" && cause.severity === "high", `Unaccepted advisory: ${name}`);
      }
    }
  }

  const relevant = findings.filter(([, finding]) => severities.indexOf(finding.severity) >= 2);
  for (const [name] of relevant) accepted(name);
  if (relevant.length) {
    assert.ok(now instanceof Date && Number.isFinite(now.getTime()), "Invalid audit clock");
    assert.ok(now.getTime() <= Date.parse(exception.expiresAt), "Temporary picomatch exception expired");
  }
  return {
    result: relevant.length ? "ACCEPTED_RISK" : "PASS",
    counts: report.metadata.vulnerabilities,
    acceptedPackages: relevant.map(([name]) => name),
    ...(relevant.length ? { advisory: exception.advisory, expiresAt: exception.expiresAt } : {}),
  };
}

function main() {
  assert.ok(process.env.npm_execpath, "Run through npm run verify:dependencies");
  const audit = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 120_000,
  });
  mkdirSync("evidence/runs", { recursive: true });
  writeFileSync("evidence/runs/npm-audit.json", audit.stdout ?? "");
  assert.ok(!audit.error && [0, 1].includes(audit.status), "npm audit could not complete");
  const report = JSON.parse(audit.stdout);
  console.log(JSON.stringify(report, null, 2));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  console.log(JSON.stringify(evaluateAudit(report, lock), null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(); }
  catch (error) {
    console.error(JSON.stringify({ result: "FAIL", message: error.message }));
    process.exitCode = 1;
  }
}
