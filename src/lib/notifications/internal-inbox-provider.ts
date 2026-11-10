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

    try {
      const { data: delivery, error: deliveryError } = await db
        .from("cueva_notification_deliveries")
        .select("id")
        .eq("notification_id", context.notificationId)
        .eq("channel", "internal")
        .maybeSingle();
      if (deliveryError || !delivery?.id) {
        return { outcome: "failed", errorCode: "internal_unavailable" };
      }

      const payload = buildInternalInboxPayload(delivery.id as string, context);
      if (!payload) return { outcome: "skipped", errorCode: "missing_student_account" };

      const { error } = await db
        .from("cueva_notification_inbox")
        .upsert(payload, {
          onConflict: "delivery_id",
          ignoreDuplicates: true,
        });
      if (error) return { outcome: "failed", errorCode: "internal_unavailable" };
      return { outcome: "sent", providerReference: `inbox:${delivery.id}` };
    } catch {
      return { outcome: "failed", errorCode: "internal_unavailable" };
    }
  };
}
