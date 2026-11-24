import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, mocks = {}) {
  const exported = {};
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", output)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`);
    return mocks[name];
  }, exported);
  return exported;
}
const idAt = index => `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`;
const history = index => ({ last_weight_kg: index, last_duration_seconds: null, entries: [], has_more: false });

function endpoint() {
  const rpcIds = [];
  const rpcCalls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "synthetic-student" } }, error: null }) },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { role: "alumno" }, error: null }) }) }),
    rpc: async (name, args) => {
      assert.equal(name, "cueva_workout_history_batch");
      assert.ok(Array.isArray(args.p_exercise_ids));
      rpcCalls.push(args.p_exercise_ids);
      rpcIds.push(...args.p_exercise_ids);
      return { data: Object.fromEntries(args.p_exercise_ids.map(id => [id, history(Number(id.slice(-12)))])), error: null };
    },
  };
  return { rpcIds, rpcCalls, ...load("src/app/api/entrenamientos/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/product-auth/server": { productConfig: () => ({}), userClient: async () => client },
    "@/lib/routines/request": {},
    "@/lib/routines/types": { uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
  }) };
}

for (const count of [100, 101, 300]) {
  test(`${count} requests use batches of at most 100 through the real GET handler`, async () => {
    const originalFetch = globalThis.fetch;
    const { requestWorkoutSummary } = load("src/lib/routines/workout-summary-batch.ts");
    const handler = endpoint();
    const sizes = [];
    globalThis.fetch = async input => {
      sizes.push(new URL(input, "https://cueva.example").searchParams.getAll("exercise_id").length);
      return handler.GET(new Request(new URL(input, "https://cueva.example")));
    };
    try {
      const promises = Array.from({ length: count }, (_, index) => requestWorkoutSummary(idAt(index)));
      assert.equal(requestWorkoutSummary(idAt(0)), promises[0], "in-flight UUID is deduplicated");
      const results = await Promise.all(promises);
      assert.deepEqual(results, Array.from({ length: count }, (_, index) => history(index)));
      assert.deepEqual(sizes, count === 100 ? [100] : count === 101 ? [100, 1] : [100, 100, 100]);
      assert.equal(handler.rpcIds.length, count);
      assert.equal(new Set(handler.rpcIds).size, count);
      assert.equal(handler.rpcCalls.length, Math.ceil(count / 100));
      assert.ok(handler.rpcCalls.every(batch => batch.length <= 100));
    } finally { globalThis.fetch = originalFetch; }
  });
}

test("a failed chunk rejects only its UUIDs and allows a new request", async () => {
  const originalFetch = globalThis.fetch;
  const { requestWorkoutSummary } = load("src/lib/routines/workout-summary-batch.ts");
  const handler = endpoint();
  let calls = 0;
  globalThis.fetch = async input => ++calls === 2 ? Response.json({}, { status: 503 })
    : handler.GET(new Request(new URL(input, "https://cueva.example")));
  try {
    const results = await Promise.allSettled(Array.from({ length: 101 }, (_, i) => requestWorkoutSummary(idAt(i))));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 100);
    assert.equal(results[100].status, "rejected");
    // Let finally clear this chunk's in-flight references.
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(await requestWorkoutSummary(idAt(100)), history(100));
  } finally { globalThis.fetch = originalFetch; }
});

test("the API itself still rejects more than 100 UUIDs", async () => {
  const handler = endpoint();
  const params = new URLSearchParams({ summary: "1" });
  for (let index = 0; index < 101; index++) params.append("exercise_id", idAt(index));
  const response = await handler.GET(new Request("https://cueva.example/api/entrenamientos?" + params));
  assert.equal(response.status, 400);
  assert.equal(handler.rpcIds.length, 0);
  assert.equal(handler.rpcCalls.length, 0);
});
