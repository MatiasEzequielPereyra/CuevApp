import test from "node:test";
import assert from "node:assert/strict";
import { runNotificationWorker } from "../src/lib/notifications/worker-engine.ts";

const period = (overrides = {}) => ({
  period_id: "period-1",
  student_id: "student-1",
  student_name: "Alumno de prueba",
  destination_email: "student@example.test",
  student_user_id: "user-1",
  period_month: "2026-11-01",
  due_on: "2026-11-20",
  amount_cents: "100000",
  paid_cents: "25000",
  balance_cents: "75000",
  student_active: true,
  ...overrides,
});

function repository({ periods = [period()], preferences = new Map([["student-1", true]]) } = {}) {
  const events = new Map();
  const deliveries = new Map();
  const cancellations = [];
  const staleDueDates = [];
  const runs = [];
  return {
    events,
    deliveries,
    cancellations,
    staleDueDates,
    runs,
    startRun: async () => {
      const id = `run-${runs.length + 1}`;
      runs.push({ id, outcome: "running" });
      return id;
    },
    loadSettings: async () => ({ sendTime: "12:00:00" }),
    loadSnapshot: async () => periods,
    loadPushPreferences: async () => preferences,
    cancelPendingPeriod: async (periodId, reason) => cancellations.push({ periodId, reason }),
    cancelStaleDueDate: async (periodId, dueOn) => staleDueDates.push({ periodId, dueOn }),
    ensureNotification: async input => {
      const key = [input.periodId, input.reminderDays, input.dueOn].join(":");
      if (!events.has(key)) events.set(key, { id: `event-${events.size + 1}`, status: "pending", ...input });
      return events.get(key);
    },
    ensureDeliveries: async input => {
      for (const channel of input.channels) {
        const key = `${input.notificationId}:${channel}`;
        if (!deliveries.has(key)) deliveries.set(key, { notificationId: input.notificationId, channel });
      }
      return input.channels.length;
    },
    claim: async () => [],
    dispatcher: {
      loadContext: async () => { throw new Error("No debería cargar contexto sin entregas"); },
      sendEmail: async () => ({ outcome: "failed", errorCode: "brevo_unavailable" }),
      createInternal: async () => ({ outcome: "sent" }),
      sendPush: async () => ({ outcome: "failed", errorCode: "push_unavailable" }),
      finalize: async () => ({ finalized: true, deliveryStatus: "sent" }),
    },
    finishRun: async (runId, outcome, processedCount) => {
      const run = runs.find(item => item.id === runId);
      run.outcome = outcome;
      run.processedCount = processedCount;
    },
  };
}

test("crea dos eventos por período y tres canales idempotentes entre ejecuciones", async () => {
  const repo = repository();
  const now = new Date("2026-11-10T15:00:00.000Z");

  const first = await runNotificationWorker(repo, now);
  const second = await runNotificationWorker(repo, now);

  assert.equal(first.eventsEnsured, 2);
  assert.equal(first.deliveriesEnsured, 6);
  assert.equal(second.eventsEnsured, 2);
  assert.equal(second.deliveriesEnsured, 6);
  assert.equal(repo.events.size, 2);
  assert.equal(repo.deliveries.size, 6);
  assert.equal(repo.runs[0].outcome, "completed");
  assert.equal(repo.runs[1].outcome, "completed");
  assert.equal(repo.staleDueDates.length, 2);
  assert.ok(repo.staleDueDates.every(item => item.dueOn === "2026-11-20"));
});

test("respeta la preferencia: push desactivado no crea entregas push", async () => {
  const repo = repository({ preferences: new Map([["student-1", false]]) });
  const result = await runNotificationWorker(repo, new Date("2026-11-10T15:00:00.000Z"));

  assert.equal(result.deliveriesEnsured, 4);
  assert.equal([...repo.deliveries.values()].filter(item => item.channel === "push").length, 0);
  assert.equal([...repo.deliveries.values()].filter(item => item.channel === "email").length, 2);
  assert.equal([...repo.deliveries.values()].filter(item => item.channel === "internal").length, 2);
});

test("cancela pendientes cuando el período queda saldado", async () => {
  const repo = repository({ periods: [period({ balance_cents: "0", paid_cents: "100000" })] });
  const result = await runNotificationWorker(repo, new Date("2026-11-10T15:00:00.000Z"));

  assert.equal(result.cancelledPeriods, 1);
  assert.equal(repo.events.size, 0);
  assert.deepEqual(repo.cancellations, [{ periodId: "period-1", reason: "balance_zero" }]);
});

test("mantiene períodos con saldo parcial y excluye alumnos inactivos", async () => {
  const repo = repository({
    periods: [
      period({ balance_cents: "1", paid_cents: "99999" }),
      period({ period_id: "period-2", student_id: "student-2", student_active: false }),
    ],
  });
  const result = await runNotificationWorker(repo, new Date("2026-11-10T15:00:00.000Z"));

  assert.equal(result.eventsEnsured, 2);
  assert.deepEqual(repo.cancellations, [{ periodId: "period-2", reason: "student_inactive" }]);
});

test("registra la ejecución como fallida si la carga del snapshot falla", async () => {
  const repo = repository();
  repo.loadSnapshot = async () => { throw new Error("snapshot unavailable"); };

  await assert.rejects(
    runNotificationWorker(repo, new Date("2026-11-10T15:00:00.000Z")),
    /snapshot unavailable/,
  );
  assert.equal(repo.runs[0].outcome, "failed");
});
