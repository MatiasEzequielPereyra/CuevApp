import test from "node:test";
import assert from "node:assert/strict";
import { dispatchClaimedDeliveries } from "../src/lib/notifications/dispatcher.ts";

const delivery = (channel, id = channel) => ({
  delivery_id: `delivery-${id}`,
  notification_id: `notification-${id}`,
  channel,
  attempt_number: 1,
  lease_token: `lease-${id}`,
  lease_expires_at: "2026-11-10T15:05:00.000Z",
});

const context = notificationId => ({
  notificationId,
  studentId: "student-1",
  studentName: "Alumno de prueba",
  destinationEmail: "student@example.test",
  studentUserId: "user-1",
  periodMonth: "2026-11-01",
  dueOn: "2026-11-20",
  balanceCents: "7500",
  reminderDays: 5,
});

function dependencies(overrides = {}) {
  const finalized = [];
  return {
    finalized,
    loadContext: async id => context(id),
    sendEmail: async () => ({ outcome: "sent", providerReference: "brevo-123" }),
    markEmailStarted: async () => true,
    createInternal: async () => ({ outcome: "sent" }),
    sendPush: async () => ({ outcome: "sent" }),
    finalize: async (item, result) => {
      finalized.push({ delivery: item, result });
      return { finalized: true, deliveryStatus: result.outcome === "unknown" ? "failed" : result.outcome === "failed" ? "pending" : result.outcome };
    },
    ...overrides,
  };
}

test("procesa email, interno y push de forma independiente", async () => {
  const deps = dependencies({
    sendEmail: async () => { throw new Error("no exponer detalles"); },
  });
  const result = await dispatchClaimedDeliveries([
    delivery("email"), delivery("internal"), delivery("push"),
  ], deps);

  assert.deepEqual(result, {
    claimed: 3, finalized: 3, stale: 0, failed: 0, errors: 0,
  });
  assert.deepEqual(deps.finalized.map(item => item.result.outcome).sort(), ["failed", "sent", "sent"]);
  assert.equal(deps.finalized.find(item => item.delivery.channel === "email").result.errorCode, "provider_error");
});

test("un resultado fallido no bloquea los otros canales", async () => {
  const deps = dependencies({
    sendEmail: async () => ({ outcome: "failed", errorCode: "brevo_unavailable" }),
  });
  const result = await dispatchClaimedDeliveries([
    delivery("email"), delivery("internal"), delivery("push"),
  ], deps);

  assert.equal(result.finalized, 3);
  assert.equal(deps.finalized.length, 3);
  assert.ok(deps.finalized.some(item => item.result.errorCode === "brevo_unavailable"));
});

test("no permite códigos de error con datos arbitrarios ni referencias excesivas", async () => {
  const deps = dependencies({
    sendEmail: async () => ({ outcome: "failed", errorCode: "email user@example.com failed" }),
    sendPush: async () => ({ outcome: "sent", providerReference: "x".repeat(201) }),
  });
  await dispatchClaimedDeliveries([delivery("email"), delivery("push")], deps);

  assert.equal(deps.finalized.find(item => item.delivery.channel === "email").result.errorCode, "provider_error");
  assert.equal(deps.finalized.find(item => item.delivery.channel === "push").result.errorCode, "invalid_provider_reference");
});

test("los leases obsoletos y fallos de finalize quedan aislados", async () => {
  let calls = 0;
  const deps = dependencies({
    finalize: async () => {
      calls += 1;
      if (calls === 1) return { finalized: false, deliveryStatus: "processing" };
      throw new Error("db error");
    },
  });
  const result = await dispatchClaimedDeliveries([delivery("email"), delivery("internal")], deps);

  assert.equal(result.stale, 1);
  assert.equal(result.errors, 1);
  assert.equal(result.finalized, 0);
});


test("preserva el resultado incierto para bloquear reintentos automáticos", async () => {
  const deps = dependencies({
    sendEmail: async () => ({ outcome: "unknown", errorCode: "brevo_result_unknown" }),
  });
  const result = await dispatchClaimedDeliveries([delivery("email")], deps);
  assert.equal(result.finalized, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(deps.finalized[0].result, { outcome: "unknown", errorCode: "brevo_result_unknown" });
});


test("marca el inicio del correo antes de invocar al proveedor", async () => {
  const order = [];
  const deps = dependencies({
    markEmailStarted: async () => { order.push("started"); return true; },
    sendEmail: async () => { order.push("provider"); return { outcome: "sent" }; },
  });
  await dispatchClaimedDeliveries([delivery("email")], deps);
  assert.deepEqual(order, ["started", "provider"]);
});

test("no llama al proveedor si la reserva ya no es válida al marcar el inicio", async () => {
  let providerCalls = 0;
  const deps = dependencies({
    markEmailStarted: async () => false,
    sendEmail: async () => { providerCalls += 1; return { outcome: "sent" }; },
  });
  const result = await dispatchClaimedDeliveries([delivery("email")], deps);
  assert.equal(providerCalls, 0);
  assert.equal(result.stale, 1);
  assert.equal(result.finalized, 0);
});
