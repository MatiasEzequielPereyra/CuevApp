import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationDispatcherDependencies,
  type NotificationDeliveryContext,
  type ProviderResult,
  type ClaimedNotificationDelivery,
  type NotificationStartResult,
} from "./dispatcher.ts";
import {
  type NotificationSnapshotRow,
  type NotificationWorkerRepository,
  runNotificationWorker,
} from "./worker-engine.ts";

type WorkerProviders = Pick<
  NotificationDispatcherDependencies,
  "sendEmail" | "createInternal" | "sendPush"
>;

function throwIfError(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(fallback);
}

export function createSupabaseNotificationWorker(
  db: SupabaseClient,
  providers: WorkerProviders,
) {
  let snapshotByPeriod = new Map<string, NotificationSnapshotRow>();

  const dispatcher: NotificationDispatcherDependencies = {
    loadContext: async (notificationId: string, delivery: ClaimedNotificationDelivery): Promise<NotificationDeliveryContext> => {
      const { data: notification, error } = await db
        .from("cueva_notifications")
        .select("period_id,reminder_days,due_on")
        .eq("id", notificationId)
        .maybeSingle();
      throwIfError(error, "No se pudo cargar el evento de notificación");
      if (!notification) throw new Error("Evento de notificación inexistente");
      const period = snapshotByPeriod.get(notification.period_id as string);
      if (!period) throw new Error("Período fuera del snapshot del worker");
      return {
        notificationId,
        studentId: period.student_id,
        studentName: period.student_name,
        destinationEmail: period.destination_email,
        studentUserId: period.student_user_id,
        periodMonth: period.period_month,
        dueOn: String(notification.due_on),
        balanceCents: String(period.balance_cents),
        reminderDays: Number(notification.reminder_days) as 5 | 1,
        deliveryId: delivery.delivery_id,
        deliveryLeaseToken: delivery.lease_token,
      };
    },
    ...providers,
    markEmailStarted: async (delivery): Promise<NotificationStartResult> => {
      const { data, error } = await db.rpc("cueva_mark_notification_delivery_started_with_balance", {
        p_delivery_id: delivery.delivery_id,
        p_lease_token: delivery.lease_token,
      });
      throwIfError(error, "No se pudo registrar el inicio del envío de correo");
      const row = Array.isArray(data) ? data[0] : null;
      return row?.started === true && typeof row.balance_cents === "string"
        && /^[1-9][0-9]*$/.test(row.balance_cents)
        ? { started: true, balanceCents: row.balance_cents }
        : { started: false, balanceCents: null };
    },
    finalize: async (delivery: ClaimedNotificationDelivery, result: ProviderResult) => {
      const { data, error } = await db.rpc("cueva_finalize_notification_delivery", {
        p_delivery_id: delivery.delivery_id,
        p_lease_token: delivery.lease_token,
        p_outcome: result.outcome,
        p_provider_reference: result.outcome === "sent" ? result.providerReference ?? null : null,
        p_error_code: result.outcome === "sent" ? null : result.errorCode,
      });
      throwIfError(error, "No se pudo finalizar la entrega");
      const row = Array.isArray(data) ? data[0] : null;
      if (!row || typeof row.finalized !== "boolean" || typeof row.delivery_status !== "string") {
        throw new Error("Respuesta inválida al finalizar la entrega");
      }
      return { finalized: row.finalized, deliveryStatus: row.delivery_status };
    },
  };

  const repository: NotificationWorkerRepository = {
    dispatcher,
    startRun: async () => {
      const { data, error } = await db
        .from("cueva_notification_runs")
        .insert({ outcome: "running", is_recovery: false })
        .select("id")
        .single();
      throwIfError(error, "No se pudo iniciar el registro de ejecución");
      if (!data?.id) throw new Error("Identificador de ejecución ausente");
      return data.id as string;
    },
    loadSettings: async () => {
      const { data, error } = await db
        .from("cueva_notification_settings")
        .select("send_time")
        .eq("singleton", true)
        .single();
      throwIfError(error, "No se pudo cargar el horario de notificaciones");
      if (typeof data?.send_time !== "string") throw new Error("Horario de notificaciones inválido");
      return { sendTime: data.send_time };
    },
    loadSnapshot: async () => {
      const { data, error } = await db.rpc("cueva_notifications_worker_snapshot");
      throwIfError(error, "No se pudo obtener el snapshot de períodos");
      if (!Array.isArray(data)) throw new Error("Snapshot de períodos inválido");
      const rows = data as NotificationSnapshotRow[];
      snapshotByPeriod = new Map(rows.map(row => [row.period_id, row]));
      return rows;
    },
    loadPushPreferences: async () => {
      const { data, error } = await db
        .from("cueva_notification_preferences")
        .select("student_id,push_enabled");
      throwIfError(error, "No se pudieron cargar las preferencias push");
      if (!Array.isArray(data)) throw new Error("Preferencias push inválidas");
      return new Map<string, boolean>(
        data.map(row => [row.student_id as string, row.push_enabled !== false]),
      );
    },
    cancelPendingPeriod: async (periodId, reason) => {
      const { data, error } = await db
        .from("cueva_notifications")
        .select("id")
        .eq("period_id", periodId)
        .eq("status", "pending");
      throwIfError(error, "No se pudieron localizar notificaciones pendientes");
      const ids = Array.isArray(data) ? data.map(row => row.id as string) : [];
      if (ids.length === 0) return;

      const { error: notificationError } = await db
        .from("cueva_notifications")
        .update({
          status: "cancelled",
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("status", "pending");
      throwIfError(notificationError, "No se pudieron cancelar notificaciones pendientes");

      const { error: deliveryError } = await db
        .from("cueva_notification_deliveries")
        .update({
          status: "cancelled",
          last_error_code: reason,
          lease_token: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .in("notification_id", ids)
        .eq("status", "pending");
      throwIfError(deliveryError, "No se pudieron cancelar entregas pendientes");
    },
    cancelStaleDueDate: async (periodId, dueOn) => {
      const { data, error } = await db
        .from("cueva_notifications")
        .select("id")
        .eq("period_id", periodId)
        .eq("status", "pending")
        .neq("due_on", dueOn);
      throwIfError(error, "No se pudieron localizar recordatorios con vencimiento anterior");
      const ids = Array.isArray(data) ? data.map(row => row.id as string) : [];
      if (ids.length === 0) return;

      const { error: notificationError } = await db
        .from("cueva_notifications")
        .update({
          status: "cancelled",
          cancellation_reason: "due_date_changed",
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("status", "pending");
      throwIfError(notificationError, "No se pudieron cancelar recordatorios obsoletos");

      const { error: deliveryError } = await db
        .from("cueva_notification_deliveries")
        .update({
          status: "cancelled",
          last_error_code: "due_date_changed",
          updated_at: new Date().toISOString(),
        })
        .in("notification_id", ids)
        .eq("status", "pending");
      throwIfError(deliveryError, "No se pudieron cancelar entregas obsoletas");
    },
    ensureNotification: async input => {
      const { error: upsertError } = await db
        .from("cueva_notifications")
        .upsert({
          period_id: input.periodId,
          reminder_days: input.reminderDays,
          due_on: input.dueOn,
          scheduled_at: input.scheduledAt,
        }, {
          onConflict: "period_id,reminder_days,due_on",
          ignoreDuplicates: true,
        });
      throwIfError(upsertError, "No se pudo asegurar el evento idempotente");

      const { data, error } = await db
        .from("cueva_notifications")
        .select("id,status")
        .eq("period_id", input.periodId)
        .eq("reminder_days", input.reminderDays)
        .eq("due_on", input.dueOn)
        .single();
      throwIfError(error, "No se pudo recuperar el evento de notificación");
      if (!data?.id || !["pending", "cancelled", "completed"].includes(data.status as string)) {
        throw new Error("Evento de notificación inválido");
      }

      return { id: data.id as string, status: data.status as "pending" | "cancelled" | "completed" };
    },
    ensureDeliveries: async input => {
      const rows = input.channels.map(channel => ({
        notification_id: input.notificationId,
        channel,
        next_attempt_at: input.scheduledAt,
      }));
      const { error } = await db
        .from("cueva_notification_deliveries")
        .upsert(rows, {
          onConflict: "notification_id,channel",
          ignoreDuplicates: true,
        });
      throwIfError(error, "No se pudieron asegurar las entregas por canal");

      const { error: scheduleError } = await db
        .from("cueva_notification_deliveries")
        .update({ next_attempt_at: input.scheduledAt, updated_at: new Date().toISOString() })
        .eq("notification_id", input.notificationId)
        .eq("status", "pending")
        .eq("attempt_count", 0);
      throwIfError(scheduleError, "No se pudo sincronizar el horario de las entregas");

      if (input.channels.includes("push")) {
        const { error: restorePushError } = await db
          .from("cueva_notification_deliveries")
          .update({
            status: "pending",
            next_attempt_at: input.scheduledAt,
            last_error_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("notification_id", input.notificationId)
          .eq("channel", "push")
          .eq("status", "cancelled")
          .lt("attempt_count", 5)
          .eq("last_error_code", "push_disabled");
        throwIfError(restorePushError, "No se pudo restaurar la preferencia push");
      } else {
        const { error: pushError } = await db
          .from("cueva_notification_deliveries")
          .update({
            status: "cancelled",
            last_error_code: "push_disabled",
            updated_at: new Date().toISOString(),
          })
          .eq("notification_id", input.notificationId)
          .eq("channel", "push")
          .eq("status", "pending");
        throwIfError(pushError, "No se pudo aplicar la preferencia push");
      }
      return input.channels.length;
    },
    claim: async (batchSize, leaseSeconds) => {
      const { data, error } = await db.rpc("cueva_claim_notification_deliveries", {
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
      });
      throwIfError(error, "No se pudieron reservar entregas");
      if (!Array.isArray(data)) throw new Error("Respuesta inválida al reservar entregas");
      return data.map(row => {
        if (!NOTIFICATION_CHANNELS.includes(row.channel as NotificationChannel)) {
          throw new Error("Canal de notificación inválido");
        }
        return row as ClaimedNotificationDelivery;
      });
    },
    finishRun: async (runId, outcome, processedCount) => {
      const { error } = await db
        .from("cueva_notification_runs")
        .update({
          outcome,
          processed_count: processedCount,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .eq("outcome", "running");
      throwIfError(error, "No se pudo cerrar el registro de ejecución");
    },
  };

  return (now = new Date()) => runNotificationWorker(repository, now);
}
