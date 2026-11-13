import type { SupabaseClient } from "@supabase/supabase-js";
import { formatReminderContent } from "./core.ts";
import type { NotificationDeliveryContext, ProviderResult } from "./dispatcher.ts";

export type InternalInboxPayload = {
  delivery_id: string;
  notification_id: string;
  student_id: string;
  user_id: string;
  title: string;
  body: string;
};

export function buildInternalInboxPayload(
  deliveryId: string,
  context: NotificationDeliveryContext,
): InternalInboxPayload | null {
  if (!context.studentUserId) return null;
  const content = formatReminderContent({
    dueOn: context.dueOn,
    periodMonth: context.periodMonth,
    balanceCents: context.balanceCents,
    studentActive: true,
  });
  return {
    delivery_id: deliveryId,
    notification_id: context.notificationId,
    student_id: context.studentId,
    user_id: context.studentUserId,
    title: content.title,
    body: content.body,
  };
}

export function createInternalInboxProvider(db: SupabaseClient) {
  return async (context: NotificationDeliveryContext): Promise<ProviderResult> => {
    if (!context.studentUserId) {
      return { outcome: "skipped", errorCode: "missing_student_account" };
    }
    const deliveryId = context.deliveryId;
    const leaseToken = context.deliveryLeaseToken;
    if (!deliveryId || !leaseToken) {
      return { outcome: "failed", errorCode: "internal_unavailable" };
    }

    try {
      let currentContext = context;
      // A partial payment may commit after the worker snapshot. The guarded
      // RPC returns the current balance and inserts only if it matches the
      // amount used to build this payload, all under the billing transaction
      // lock. Rebuild a few times if another partial payment wins the race.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const payload = buildInternalInboxPayload(deliveryId, currentContext);
        if (!payload) return { outcome: "skipped", errorCode: "missing_student_account" };

        const { data, error } = await db.rpc("cueva_create_notification_inbox_guarded", {
          p_delivery_id: deliveryId,
          p_lease_token: leaseToken,
          p_student_id: currentContext.studentId,
          p_user_id: currentContext.studentUserId,
          p_title: payload.title,
          p_body: payload.body,
          p_expected_balance_cents: currentContext.balanceCents,
        });
        if (error || !Array.isArray(data) || data.length === 0) {
          return { outcome: "failed", errorCode: "internal_unavailable" };
        }

        const result = data[0] as {
          created?: boolean;
          balance_cents?: string | number;
          reason?: string | null;
        };
        if (result.created === true) {
          return { outcome: "sent", providerReference: `inbox:${deliveryId}` };
        }
        if (result.reason !== "balance_changed" || result.balance_cents == null
          || !/^[0-9]+$/.test(String(result.balance_cents))
          || BigInt(result.balance_cents) <= 0n) {
          return { outcome: "skipped", errorCode: "notification_not_relevant" };
        }
        currentContext = { ...currentContext, balanceCents: String(result.balance_cents) };
      }
      return { outcome: "failed", errorCode: "internal_unavailable" };
    } catch {
      return { outcome: "failed", errorCode: "internal_unavailable" };
    }
  };
}
