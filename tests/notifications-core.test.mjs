import test from "node:test";
import assert from "node:assert/strict";
import {
  buenosAiresDate,
  buenosAiresDateTimeToUtc,
  buildReminderPlan,
  formatReminderContent,
} from "../src/lib/notifications/core.ts";

const period = { dueOn: "2026-11-20", periodMonth: "2026-11-01", balanceCents: 7500, studentActive: true };

test("interpreta el día local de Buenos Aires, no el UTC", () => {
  assert.equal(buenosAiresDate(new Date("2026-11-10T02:30:00.000Z")), "2026-11-09");
  assert.equal(buenosAiresDate(new Date("2026-11-10T03:30:00.000Z")), "2026-11-10");
});

test("convierte el horario de envío local a UTC", () => {
  assert.equal(buenosAiresDateTimeToUtc("2026-11-15", "12:00").toISOString(), "2026-11-15T15:00:00.000Z");
});

test("planifica los dos recordatorios y respeta el horario efectivo", () => {
  const before = buildReminderPlan(period, "12:00", new Date("2026-11-15T14:59:00.000Z"));
  assert.deepEqual(before.map(item => item.reminderDays), [5, 1]);
  assert.equal(before[0].scheduledAt, "2026-11-15T15:00:00.000Z");
  assert.equal(before[0].ready, false);
  const atTime = buildReminderPlan(period, "12:00", new Date("2026-11-15T15:00:00.000Z"));
  assert.equal(atTime[0].ready, true);
  assert.equal(atTime[1].ready, false);
});

test("los pagos parciales conservan recordatorios y saldo cero los excluye", () => {
  assert.equal(buildReminderPlan(period, "12:00", new Date("2026-11-15T15:00:00.000Z")).length, 2);
  assert.deepEqual(buildReminderPlan({ ...period, balanceCents: 0 }, "12:00", new Date("2026-11-15T15:00:00.000Z")), []);
});

test("acepta centavos como texto o bigint sin convertirlos a number", () => {
  const largeBalance = "9007199254740993";
  const plan = buildReminderPlan({ ...period, balanceCents: largeBalance }, "12:00", new Date("2026-11-15T15:00:00.000Z"));
  assert.equal(plan.length, 2);

  const content = formatReminderContent({ ...period, balanceCents: largeBalance });
  assert.match(content.body, /90\.071\.992\.547\.409,93/);
  assert.match(formatReminderContent({ ...period, balanceCents: 7500n }).body, /75,00/);
  assert.throws(() => buildReminderPlan({ ...period, balanceCents: Number.MAX_SAFE_INTEGER + 1 }, "12:00", new Date()), /Saldo inválido/);
});

test("excluye alumnos inactivos y vencimientos alcanzados", () => {
  assert.deepEqual(buildReminderPlan({ ...period, studentActive: false }, "12:00", new Date("2026-11-15T15:00:00.000Z")), []);
  assert.deepEqual(buildReminderPlan(period, "12:00", new Date("2026-11-20T15:00:00.000Z")), []);
});

test("el contenido identifica período, vencimiento y saldo pendiente", () => {
  const content = formatReminderContent(period);
  assert.equal(content.title, "Recordatorio de cuota");
  assert.match(content.subject, /noviembre de 2026/i);
  assert.match(content.body, /20 de noviembre de 2026/i);
  assert.match(content.body, /75,00/);
});

test("rechaza fechas, horarios y saldos inválidos", () => {
  assert.throws(() => buildReminderPlan({ ...period, dueOn: "2026-02-30" }, "12:00", new Date()));
  assert.throws(() => buildReminderPlan(period, "25:00", new Date()));
  assert.throws(() => buildReminderPlan({ ...period, balanceCents: -1 }, "12:00", new Date()));
  assert.throws(() => buildReminderPlan({ ...period, balanceCents: "7.500" }, "12:00", new Date()));
});
