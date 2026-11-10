import test from "node:test";
import assert from "node:assert/strict";
import { buildInternalInboxPayload } from "../src/lib/notifications/internal-inbox-provider.ts";

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

  assert.deepEqual(payload, {
    delivery_id: "delivery-1",
    notification_id: "notification-1",
    student_id: "student-1",
    user_id: "user-1",
    title: "Recordatorio de cuota",
    body: assert.match(payload.body, /noviembre de 2026/) && assert.match(payload.body, /750,00/),
  });
});

test("no crea una entrada interna si el alumno no tiene cuenta vinculada", () => {
  assert.equal(buildInternalInboxPayload("delivery-1", context({ studentUserId: null })), null);
});
