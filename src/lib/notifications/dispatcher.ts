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
};

export type ProviderResult =
  | { outcome: "sent"; providerReference?: string | null }
  | { outcome: "failed"; errorCode: string }
  | { outcome: "skipped"; errorCode: string };

export type NotificationDispatcherDependencies = {
  loadContext(notificationId: string): Promise<NotificationDeliveryContext>;
  sendEmail(context: NotificationDeliveryContext): Promise<ProviderResult>;
  createInternal(context: NotificationDeliveryContext): Promise<ProviderResult>;
  sendPush(context: NotificationDeliveryContext): Promise<ProviderResult>;
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

const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{1,79}$/;

function safeFailureCode(value: unknown): string {
  return typeof value === "string" && SAFE_ERROR_CODE.test(value)
    ? value
    : "provider_error";
}

function providerFor(
  channel: NotificationChannel,
  dependencies: NotificationDispatcherDependencies,
) {
  switch (channel) {
    case "email": return dependencies.sendEmail;
    case "internal": return dependencies.createInternal;
    case "push": return dependencies.sendPush;
  }
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
      const context = await dependencies.loadContext(delivery.notification_id);
      result = await providerFor(delivery.channel, dependencies)(context);
      if (result.outcome !== "sent" && result.outcome !== "failed" && result.outcome !== "skipped") {
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
