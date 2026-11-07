import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";
import { createRequire } from "node:module";

const load = createRequire(import.meta.url);
const unit = { exports: {} };
const source = fs.readFileSync("src/components/payments/due-date-manager.tsx", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const runtimeRequire = (name) => name === "next/navigation" ? { useRouter: () => ({ refresh() {} }) } : name === "@/lib/payments/operation-key" ? loadOperationKeySync() : load(name);
new Function("require", "module", "exports", output)(runtimeRequire, unit, unit.exports);

const { monthAfter, dueDate, dateLabel } = unit.exports;

const React = load("react");
const { renderToStaticMarkup } = load("react-dom/server");

test("due date manager renders the next period by default and exposes change and rejection history", () => {
  const markup = renderToStaticMarkup(React.createElement(unit.exports.DueDateManager, {
    studentId: "student-1",
    currentMonth: "2026-11",
    currentDay: 15,
    nextDay: 15,
    currentDueOn: "2026-11-15",
    nextDueOn: null,
    history: [{
      id: "audit-1", actor: "admin-1", actor_email: "admin@example.test",
      old_due_day: 10, new_due_day: 15, effective_month: "2026-11-01",
      scope: "current_period", reason: "Acuerdo con alumno", result: "applied",
      recorded_at: "2026-11-06T12:00:00Z",
    }],
    attempts: [{
      id: "attempt-1", operation_id: "operation-1", actor_email: "admin@example.test",
      requested_due_day: "32", effective_month: "2026-12", scope: "next_period",
      requested_reason: "Corrección", error_code: "22023",
      error_message: "Día de vencimiento inválido", recorded_at: "2026-11-06T12:01:00Z",
    }],
  }));
  assert.match(markup, /Próximo período/);
  assert.match(markup, /Fecha anterior/);
  assert.match(markup, /Fecha nueva/);
  assert.match(markup, /admin@example\.test/);
  assert.match(markup, /Día de vencimiento inválido/);
  assert.match(markup, /Intentos rechazados/);
});

test("next period calculation crosses year boundaries", () => {
  assert.equal(monthAfter("2026-01"), "2026-02");
  assert.equal(monthAfter("2026-12"), "2027-01");
});

test("due date clamps to month end without drifting the reference day", () => {
  assert.equal(dueDate(31, "2026-02"), "2026-02-28");
  assert.equal(dueDate(31, "2028-02"), "2028-02-29");
  assert.equal(dueDate(31, "2026-03"), "2026-03-31");
  assert.equal(dueDate(30, "2026-04"), "2026-04-30");
});

test("date preview labels the date in Spanish without timezone day shifts", () => {
  const label = dateLabel("2026-02-28").toLocaleLowerCase("es-AR");
  assert.match(label, /28/);
  assert.match(label, /febrero/);
  assert.match(label, /2026/);
});


test("operation retries preserve the idempotency key while the result is uncertain", async () => {
  const { operationForSubmission } = await loadOperationKey();
  const first = operationForSubmission(null, "same-payload", false, () => "op-1");
  const retry = operationForSubmission(first, "same-payload", false, () => "op-2");
  assert.equal(retry.op, "op-1");
  assert.throws(() => operationForSubmission(first, "changed-payload", false, () => "op-2"), /resultado anterior sigue siendo incierto/);
});

test("a definitive server rejection allows a corrected payload to receive a new key", async () => {
  const { operationForSubmission } = await loadOperationKey();
  const first = operationForSubmission(null, "invalid-payload", false, () => "op-1");
  const corrected = operationForSubmission(first, "corrected-payload", true, () => "op-2");
  assert.equal(corrected.op, "op-2");
  assert.equal(corrected.payload, "corrected-payload");
});

async function loadOperationKey() {
  const source = fs.readFileSync("src/lib/payments/operation-key.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const unit = { exports: {} };
  new Function("require", "module", "exports", output)(load, unit, unit.exports);
  return unit.exports;
}


test("only a definitive database error proves the operation was rolled back", async () => {
  const { isDefinitiveDatabaseError } = await loadOperationKey();
  assert.equal(isDefinitiveDatabaseError("P0001"), true);
  assert.equal(isDefinitiveDatabaseError("23505"), true);
  assert.equal(isDefinitiveDatabaseError("22023"), true);
  assert.equal(isDefinitiveDatabaseError("08006"), false);
  assert.equal(isDefinitiveDatabaseError("08001"), false);
  assert.equal(isDefinitiveDatabaseError("ECONNRESET"), false);
  assert.equal(isDefinitiveDatabaseError("PGRST116"), false);
  assert.equal(isDefinitiveDatabaseError(undefined), false);
});

function loadOperationKeySync() {
  const source = fs.readFileSync("src/lib/payments/operation-key.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const unit = { exports: {} };
  new Function("require", "module", "exports", output)(load, unit, unit.exports);
  return unit.exports;
}


test("pending operations persist across reload and can be cleared after a definitive result", async () => {
  const { persistPendingOperation, readPendingOperation, clearPendingOperation } = await loadOperationKey();
  const values = new Map();
  globalThis.window = { sessionStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } };
  const pending = { op: "00000000-0000-4000-8000-000000000001", payload: JSON.stringify({ kind: "payment", cents: "4000" }) };
  persistPendingOperation("billing:test", pending);
  assert.deepEqual(readPendingOperation("billing:test"), pending);
  clearPendingOperation("billing:test");
  assert.equal(readPendingOperation("billing:test"), null);
  delete globalThis.window;
});
