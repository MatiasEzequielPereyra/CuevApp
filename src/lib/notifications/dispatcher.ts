export const NOTIFICATION_CHANNELS = ["email", "internal", "push"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type ClaimedNotificationDelivery = {
  delivery_id: string;
  notification_id: string;
  channel: NotificationChannel;
  attempt_number: number;
  lease_token: string;
  lease_expires_at: string;
};

export type NotificationDeliveryContext = {
  notificationId: string;
  studentId: string;
  studentName: string;
  destinationEmail: string | null;
  studentUserId: string | null;
  periodMonth: string;
  dueOn: string;
  balanceCents: string;
  reminderDays: 5 | 1;
  /** Internal lease identity for provider-side, per-target idempotency. */
  deliveryId?: string;
  deliveryLeaseToken?: string;
};

export type ProviderResult =
  | { outcome: "sent"; providerReference?: string | null }
  | { outcome: "failed"; errorCode: string }
  | { outcome: "unknown"; errorCode: string }
  | { outcome: "skipped"; errorCode: string };

export type NotificationDispatcherDependencies = {
  loadContext(notificationId: string, delivery: ClaimedNotificationDelivery): Promise<NotificationDeliveryContext>;
  sendEmail(context: NotificationDeliveryContext): Promise<ProviderResult>;
  createInternal(context: NotificationDeliveryContext): Promise<ProviderResult>;
  sendPush(context: NotificationDeliveryContext): Promise<ProviderResult>;
  markEmailStarted(delivery: ClaimedNotificationDelivery): Promise<boolean>;
  finalize(
    delivery: ClaimedNotificationDelivery,
    result: ProviderResult,
  ): Promise<{ finalized: boolean; deliveryStatus: string }>;
};

export type NotificationDispatchSummary = {
  claimed: number;
  finalized: number;
  stale: number;
  failed: number;
  errors: number;
};

const SAFE_ERROR_CODES = new Set([
  "brevo_unavailable",
  "brevo_result_unknown",
  "brevo_rejected",
  "missing_destination",
  "internal_unavailable",
  "missing_student_account",
  "push_unavailable",
  "push_result_unknown",
  "push_subscription_expired",
  "missing_push_subscription",
  "notification_not_relevant",
  "provider_error",
  "invalid_provider_result",
  "invalid_provider_reference",
]);

function safeFailureCode(value: unknown): string {
  return typeof value === "string" && SAFE_ERROR_CODES.has(value)
    ? value
    : "provider_error";
}

function providerFor(
  channel: NotificationChannel,
  dependencies: NotificationDispatcherDependencies,
) {
  return {
    email: dependencies.sendEmail,
    internal: dependencies.createInternal,
    push: dependencies.sendPush,
  }[channel];
}

/**
 * Dispatches an already-claimed batch. Claiming and lease ownership remain
 * database responsibilities; this layer isolates each channel and records
 * every outcome through the lease-checked finalize RPC.
 */
export async function dispatchClaimedDeliveries(
  deliveries: ClaimedNotificationDelivery[],
  dependencies: NotificationDispatcherDependencies,
): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    claimed: deliveries.length,
    finalized: 0,
    stale: 0,
    failed: 0,
    errors: 0,
  };

  await Promise.all(deliveries.map(async delivery => {
    let result: ProviderResult;
    try {
      const context = await dependencies.loadContext(delivery.notification_id, delivery);
      if (delivery.channel === "email" && !(await dependencies.markEmailStarted(delivery))) {
        summary.stale += 1;
        return;
      }
      result = await providerFor(delivery.channel, dependencies)(context);
      if (result.outcome !== "sent" && result.outcome !== "failed" && result.outcome !== "unknown" && result.outcome !== "skipped") {
        result = { outcome: "failed", errorCode: "invalid_provider_result" };
      }
      if (result.outcome !== "sent") {
        result = { ...result, errorCode: safeFailureCode(result.errorCode) };
      } else if (result.providerReference && result.providerReference.length > 200) {
        result = { outcome: "failed", errorCode: "invalid_provider_reference" };
      }
    } catch {
      result = { outcome: "failed", errorCode: "provider_error" };
    }

    try {
      const finalized = await dependencies.finalize(delivery, result);
      if (!finalized.finalized) {
        summary.stale += 1;
        return;
      }
      summary.finalized += 1;
      if (finalized.deliveryStatus === "failed") summary.failed += 1;
    } catch {
      // A failed finalize must not prevent other claimed channels from settling.
      summary.errors += 1;
    }
  }));

  return summary;
}
