import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { startStudentsApp, studentFixture, signIn } from "./admin-students-fixture.ts";
import { attachFocusEvidence } from "./focus-evidence.ts";

const origins = ["http://127.0.0.1:3264", "http://127.0.0.1:3265"];
const fixtures = [], apps = [];
const sourceFiles = ["tsconfig.json", "next-env.d.ts"];
const before = sourceFiles.map(file => existsSync(file) ? readFileSync(file) : null);
async function ready(app, origin) {
  for (let i = 0; i < 110; i++) {
    assert.equal(app.processHandle.exitCode, null, `fixture ${origin} exited before readiness`);
    try { if ((await fetch(origin + "/ingresar")).status === 200) return; } catch {}
    await delay(500);
  }
  throw Error("Fixture readiness timed out");
}
async function accountPage(index) {
  const email = `fixture-${index}@example.test`;
  let cookies;
  await signIn({ addCookies: async value => { cookies = value; } }, origins[index]);
  const response = await fetch(origins[index] + "/cuenta", { headers: { cookie: cookies.map(({name,value}) => `${name}=${value}`).join("; ") } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes(email), "each app must use its own synthetic backend");
  assert.ok(!html.includes(`fixture-${1-index}@example.test`));
  assert.equal(response.headers.get("cache-control"), "no-store");
}
try {
  for (const [index, origin] of origins.entries()) {
    const fixture = await studentFixture(async (_request, url) => url.pathname === "/user"
      ? { body: { user: { id: "11111111-1111-4111-8111-111111111111", email: `fixture-${index}@example.test`, role: "authenticated" } } } : undefined);
    fixtures.push(fixture);
    apps.push(startStudentsApp(origin, fixture.endpoint));
  }
  await Promise.all(apps.map((app,index) => ready(app,origins[index])));
  assert.notEqual(apps[0].workspace, apps[1].workspace);
  await Promise.all(origins.map((_,index) => accountPage(index)));
  const occupied = startStudentsApp(origins[0], fixtures[0].endpoint);
  apps.push(occupied);
  const [code] = await once(occupied.processHandle, "exit", { signal: AbortSignal.timeout(55_000) });
  assert.equal(code, 1, "a real bind failure must exit promptly");
  await occupied.close();
  assert.equal(existsSync(occupied.workspace), false);
  await Promise.all([apps[0].close(), apps[0].close()]);
  assert.equal(existsSync(apps[0].workspace), false);
  await accountPage(1);
  const restarted = startStudentsApp(origins[0], fixtures[0].endpoint);
  apps.push(restarted);
  await ready(restarted, origins[0]);
  await accountPage(0);
  console.log("PASS: two Next fixtures coexist; backends and generated files are isolated; close/restart and failed-start cleanup preserve the other app.");
} finally {
  const results = await Promise.allSettled(apps.map(app => app.close()));
  await Promise.allSettled(fixtures.map(fixture => fixture.close()));
  for (const result of results) if (result.status === "rejected") throw result.reason;
}
for (const [index,file] of sourceFiles.entries()) {
  assert.deepEqual(existsSync(file) ? readFileSync(file) : null, before[index], `fixture must not rewrite ${file}`);
}
for (const app of apps) assert.equal(existsSync(app.workspace), false);
for (const attachmentFails of [false,true]) {
  const primary = new Error("original focus assertion");
  const attachments = [];
  await assert.rejects(async () => {
    try { throw primary; }
    finally {
      await attachFocusEvidence({ evaluate: async () => { throw Error("page closed"); } }, {
        attach: async (name) => { attachments.push(name); if (attachmentFails) throw Error("attachment unavailable"); },
      });
    }
  }, error => error === primary);
  assert.deepEqual(attachments, ["focus-evidence-unavailable"]);
}
console.log("PASS: failed evidence collection cannot replace the original focus assertion, even if attaching the fallback also fails.");
