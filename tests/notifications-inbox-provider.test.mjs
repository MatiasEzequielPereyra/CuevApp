import test from "node:test";
import assert from "node:assert/strict";
import { buildInternalInboxPayload, createInternalInboxProvider } from "../src/lib/notifications/internal-inbox-provider.ts";

const context = overrides => ({
  notificationId: "notification-1",
  studentId: "student-1",
  studentName: "Alumno de prueba",
  destinationEmail: "student@example.test",
  studentUserId: "user-1",
  periodMonth: "2026-11-01",
  dueOn: "2026-11-20",
  balanceCents: "75000",
  reminderDays: 5,
  ...overrides,
});

test("construye la notificación interna con período, vencimiento y saldo", () => {
  const payload = buildInternalInboxPayload("delivery-1", context());

  assert.deepEqual({
    delivery_id: payload.delivery_id,
    notification_id: payload.notification_id,
    student_id: payload.student_id,
    user_id: payload.user_id,
    title: payload.title,
  }, {
    delivery_id: "delivery-1",
    notification_id: "notification-1",
    student_id: "student-1",
    user_id: "user-1",
    title: "Recordatorio de cuota",
  });
  assert.match(payload.body, /noviembre de 2026/);
  assert.match(payload.body, /750/);
});

test("no crea una entrada interna si el alumno no tiene cuenta vinculada", () => {
  assert.equal(buildInternalInboxPayload("delivery-1", context({ studentUserId: null })), null);
});


test("rebuilds the inbox body when a partial payment changes the balance after the worker snapshot", async () => {
  const calls = [];
  const responses = [
    { data: [{ created: false, balance_cents: "50000", reason: "balance_changed" }], error: null },
    { data: [{ created: true, balance_cents: "50000", reason: null }], error: null },
  ];
  const provider = createInternalInboxProvider({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return responses.shift();
    },
  });

  const result = await provider({
    ...context(),
    deliveryId: "delivery-1",
    deliveryLeaseToken: "lease-1",
  });

  assert.deepEqual(result, { outcome: "sent", providerReference: "inbox:delivery-1" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args.p_expected_balance_cents, "75000");
  assert.equal(calls[1].args.p_expected_balance_cents, "50000");
  assert.match(calls[1].args.p_body, /500/);
});

test("does not create an inbox item when the guarded RPC reports a settled period", async () => {
  let calls = 0;
  const provider = createInternalInboxProvider({
    rpc: async () => {
      calls += 1;
      return { data: [{ created: false, balance_cents: "0", reason: "balance_zero" }], error: null };
    },
  });

  const result = await provider({
    ...context(),
    deliveryId: "delivery-1",
    deliveryLeaseToken: "lease-1",
  });

  assert.deepEqual(result, { outcome: "skipped", errorCode: "notification_not_relevant" });
  assert.equal(calls, 1);
});
