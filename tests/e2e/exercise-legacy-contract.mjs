import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Frozen deployed route, not a reimplementation of its seven-field contract.
const legacySource = readFileSync("tests/fixtures/exercise-route-e754727.txt", "utf8");
assert.equal(createHash("sha256").update(legacySource).digest("hex"),
  "e46334f8de6139236ad7c3fd06cad2b0bfc7d0c249aaf1498eef9cab4f5474a3");
function load(source, mocks = {}) {
  const exported = {};
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  new Function("require", "exports", output)(id => mocks[id] ?? require(id), exported);
  return exported;
}
const helpers = {
  "@/lib/routines/request": load(readFileSync("src/lib/routines/request.ts", "utf8")),
  "@/lib/routines/video": load(readFileSync("src/lib/routines/video.ts", "utf8")),
  "@/lib/routines/types": load(readFileSync("src/lib/routines/types.ts", "utf8")),
};

export async function verifyLegacyExerciseContract({ adminClient, studentClient, anonClient, origin }) {
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const route = load(legacySource, {
    ...helpers,
    "@/lib/students/server": { studentAdmin: async () => adminClient },
    "@/lib/product-auth/server": { productConfig: () => ({ origin }) },
  });
  const body = { id: randomUUID(), name: "Legacy contract " + randomUUID(), active: true,
    revision: 0, description: "", video_url: null, video_path: null };
  const post = payload => route.POST(new Request(origin + "/api/ejercicios", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload),
  }));
  const rpcArgs = payload => ({ p_id: payload.id, p_name: payload.name, p_active: payload.active,
    p_revision: payload.revision, p_description: payload.description,
    p_video_url: payload.video_url, p_video_path: payload.video_path });
  const expectSaved = async (payload, revision, mode) => {
    const response = await post(payload);
    assert.equal(response.status, 200, "deployed route must work against migrated PostgREST");
    const { exercise } = await response.json();
    assert.equal(exercise.id, body.id);
    assert.equal(exercise.revision, revision);
    assert.equal(exercise.tracking_mode, mode);
  };
  await expectSaved(body, 1, "weight");
  const changed = await adminClient.rpc("cueva_exercise_write", {
    ...rpcArgs({ ...body, revision: 1 }), p_tracking_mode: "time",
  });
  assert.equal(changed.error, null);
  assert.equal(changed.data.tracking_mode, "time");
  await expectSaved({ ...body, revision: 2, description: "Old client edit" }, 3, "time");
  assert.equal((await post({ ...body, revision: 1, description: "stale" })).status, 409);
  const current = await adminClient.rpc("cueva_exercise_write", {
    ...rpcArgs({ ...body, revision: 3, description: "New client edit" }), p_tracking_mode: "time",
  });
  assert.equal(current.error, null);
  // Roll the application back while keeping the migrated schema and time data.
  const rollback = { ...body, revision: 4, description: "Rollback client edit" };
  await expectSaved(rollback, 5, "time");
  await expectSaved(rollback, 5, "time"); // same-operation replay is idempotent

  const [oldResponse, newResponse] = await Promise.all([
    post({ ...body, revision: 5, description: "Concurrent old client" }),
    adminClient.rpc("cueva_exercise_write", {
      ...rpcArgs({ ...body, revision: 5, description: "Concurrent new client" }), p_tracking_mode: "weight",
    }),
  ]);
  assert.deepEqual([oldResponse.status, newResponse.error ? 409 : 200].sort(), [200, 409]);
  if (newResponse.error) assert.equal(newResponse.error.code, "40001");
  const final = await adminClient.from("cueva_exercises").select("revision,tracking_mode").eq("id", body.id).single();
  assert.equal(final.error, null);
  assert.equal(final.data.revision, 6);
  assert.equal(final.data.tracking_mode, oldResponse.status === 200 ? "time" : "weight");
  for (const client of [studentClient, anonClient]) {
    const denied = await client.rpc("cueva_exercise_write", rpcArgs({ ...body, revision: 6 }));
    assert.equal(denied.error?.code, "42501");
  }
  console.log("PASS legacy deployed route -> migrated PostgREST -> new client -> rollback; CAS/replay/roles");
}
