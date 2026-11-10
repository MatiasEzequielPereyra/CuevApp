import {
  buildReminderPlan,
  buenosAiresDate,
  type ReminderDays,
} from "./core.ts";
import {
  dispatchClaimedDeliveries,
  type ClaimedNotificationDelivery,
  type NotificationDispatcherDependencies,
  type NotificationDispatchSummary,
  type NotificationChannel,
} from "./dispatcher.ts";

export type NotificationSnapshotRow = {
  period_id: string;
  student_id: string;
  student_name: string;
  destination_email: string | null;
  student_user_id: string | null;
  period_month: string;
  due_on: string;
  amount_cents: number | string;
  paid_cents: number | string;
  balance_cents: number | string;
  student_active: boolean;
};

export type NotificationWorkerSettings = { sendTime: string };
export type NotificationEvent = {
  id: string;
  status: "pending" | "cancelled" | "completed";
};
export type NotificationWorkerSummary = {
  runId: string;
  periods: number;
  eventsEnsured: number;
  deliveriesEnsured: number;
  cancelledPeriods: number;
  dispatch: NotificationDispatchSummary;
};

export type NotificationWorkerRepository = {
  startRun(): Promise<string>;
  loadSettings(): Promise<NotificationWorkerSettings>;
  loadSnapshot(): Promise<NotificationSnapshotRow[]>;
  loadPushPreferences(): Promise<Map<string, boolean>>;
  cancelPendingPeriod(periodId: string, reason: string): Promise<void>;
  cancelStaleDueDate(periodId: string, dueOn: string): Promise<void>;
  ensureNotification(input: {
    periodId: string;
    reminderDays: ReminderDays;
    dueOn: string;
    scheduledAt: string;
  }): Promise<NotificationEvent>;
  ensureDeliveries(input: {
    notificationId: string;
    scheduledAt: string;
    channels: NotificationChannel[];
  }): Promise<number>;
  claim(batchSize: number, leaseSeconds: number): Promise<ClaimedNotificationDelivery[]>;
  dispatcher: NotificationDispatcherDependencies;
  finishRun(runId: string, outcome: "completed" | "partial" | "failed", processedCount: number): Promise<void>;
};

function positiveBalance(value: number | string): string {
  if (!/^-?[0-9]+$/.test(String(value))) throw new TypeError("Saldo inválido");
  const balance = BigInt(value);
  return balance > 0n ? balance.toString() : "0";
}

function cancellationReason(period: NotificationSnapshotRow, balance: string, today: string): string | null {
  if (!period.student_active) return "student_inactive";
  if (balance === "0") return "balance_zero";
  if (period.due_on <= today) return "due_date_passed";
  return null;
}

export async function runNotificationWorker(
  repository: NotificationWorkerRepository,
  now = new Date(),
): Promise<NotificationWorkerSummary> {
  const runId = await repository.startRun();
  let processedCount = 0;
  try {
    if (!Number.isFinite(now.getTime())) throw new TypeError("Instante inválido");
    const [settings, snapshot, preferences] = await Promise.all([
      repository.loadSettings(),
      repository.loadSnapshot(),
      repository.loadPushPreferences(),
    ]);
    const sendTime = settings.sendTime.slice(0, 5);
    let eventsEnsured = 0;
    let deliveriesEnsured = 0;
    let cancelledPeriods = 0;

    for (const period of snapshot) {
      const balanceCents = positiveBalance(period.balance_cents);
      const reason = cancellationReason(period, balanceCents, buenosAiresDate(now));
      if (reason) {
        await repository.cancelPendingPeriod(period.period_id, reason);
        cancelledPeriods += 1;
        continue;
      }

      await repository.cancelStaleDueDate(period.period_id, period.due_on);
      const candidates = buildReminderPlan({
        dueOn: period.due_on,
        periodMonth: period.period_month,
        balanceCents,
        studentActive: period.student_active,
      }, sendTime, now);

      for (const candidate of candidates) {
        const event = await repository.ensureNotification({
          periodId: period.period_id,
          reminderDays: candidate.reminderDays,
          dueOn: period.due_on,
          scheduledAt: candidate.scheduledAt,
        });
        eventsEnsured += 1;
        if (event.status !== "pending") continue;

        const channels: NotificationChannel[] = ["email", "internal"];
        if (preferences.get(period.student_id) !== false) channels.push("push");
        deliveriesEnsured += await repository.ensureDeliveries({
          notificationId: event.id,
          scheduledAt: candidate.scheduledAt,
          channels,
        });
      }
    }

    const claimed = await repository.claim(25, 300);
    const dispatch = await dispatchClaimedDeliveries(claimed, repository.dispatcher);
    processedCount = dispatch.finalized;
    const outcome = dispatch.errors > 0 || dispatch.failed > 0 ? "partial" : "completed";
    await repository.finishRun(runId, outcome, processedCount);

    return {
      runId,
      periods: snapshot.length,
      eventsEnsured,
      deliveriesEnsured,
      cancelledPeriods,
      dispatch,
    };
  } catch (error) {
    try {
      await repository.finishRun(runId, "failed", processedCount);
    } catch {
      // Preserve the original worker error if run finalization also fails.
    }
    throw error;
  }
}
