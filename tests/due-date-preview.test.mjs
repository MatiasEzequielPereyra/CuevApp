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
const runtimeRequire = (name) => name === "next/navigation" ? { useRouter: () => ({ refresh() {} }) } : load(name);
new Function("require", "module", "exports", output)(runtimeRequire, unit, unit.exports);

const { monthAfter, dueDate, dateLabel } = unit.exports;

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
