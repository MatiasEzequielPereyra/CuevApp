import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";
import { createRequire } from "node:module";

const load = createRequire(import.meta.url);
const state = { config: { origin: "http://127.0.0.1:3000" }, rpcResult: { data: "00000000-0000-4000-8000-000000000001", error: null }, rpcCalls: 0 };
const operationSource = fs.readFileSync("src/lib/payments/operation-key.ts", "utf8");
const operationOutput = ts.transpileModule(operationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const operationModule = { exports: {} };
new Function("require", "module", "exports", operationOutput)(load, operationModule, operationModule.exports);

const source = fs.readFileSync("src/app/api/pagos/route.ts", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const routeModule = { exports: {} };
const runtimeRequire = (name) => {
  if (name === "next/server") return { NextResponse: { json: (body, options = {}) => new Response(JSON.stringify(body), { status: options.status ?? 200, headers: options.headers }) } };
  if (name === "@/lib/students/server") return { studentAdmin: async () => ({ rpc: async (...args) => { state.rpcCalls += 1; state.rpcArgs = args; return state.rpcResult; } }) };
  if (name === "@/lib/product-auth/server") return { productConfig: () => state.config };
  if (name === "@/lib/payments/operation-key") return operationModule.exports;
  return load(name);
};
new Function("require", "module", "exports", output)(runtimeRequire, routeModule, routeModule.exports);
const { POST } = routeModule.exports;

function request({ origin = state.config.origin, body = { op: "00000000-0000-4000-8000-000000000001", p: { kind: "due_day" } }, contentType = "application/json" } = {}) {
  return new Request("http://127.0.0.1:3000/api/pagos", {
    method: "POST",
    headers: { origin, "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("a database rejection recorded by the guarded RPC is returned as a definitive 409", async () => {
  state.rpcCalls = 0;
  state.rpcResult = { data: null, error: null };
  const response = await POST(request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).operation_not_applied, true);
  assert.equal(state.rpcCalls, 1);
});

test("an uncertain transport error preserves the operation key for safe retry", async () => {
  state.rpcResult = { data: null, error: { code: "ECONNRESET", message: "connection lost" } };
  const response = await POST(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).operation_not_applied, false);
});

test("a definitive SQL constraint error reports that the transaction did not apply", async () => {
  state.rpcResult = { data: null, error: { code: "23505", message: "duplicate" } };
  const response = await POST(request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).operation_not_applied, true);
});

test("a successful RPC returns a no-store success response", async () => {
  state.rpcResult = { data: "00000000-0000-4000-8000-000000000001", error: null };
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).message, "Operación registrada.");
});

test("origin and malformed payload are rejected before calling the database", async () => {
  state.rpcCalls = 0;
  const origin = await POST(request({ origin: "https://attacker.example" }));
  assert.equal(origin.status, 403);
  const malformed = await POST(request({ body: { op: "invalid", p: {} } }));
  assert.equal(malformed.status, 400);
  assert.equal(state.rpcCalls, 0);
});
