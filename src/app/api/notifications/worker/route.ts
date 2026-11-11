import { isAuthorizedNotificationWorkerRequest } from "@/lib/notifications/worker-endpoint-auth";
import { runSupabaseNotificationWorker } from "@/lib/notifications/notification-worker-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!isAuthorizedNotificationWorkerRequest(
    request,
    process.env.CUEVA_NOTIFICATIONS_CRON_SECRET,
  )) {
    return Response.json({ ok: false }, { status: 403, headers });
  }

  try {
    const summary = await runSupabaseNotificationWorker();
    return Response.json({
      ok: true,
      periods: summary.periods,
      eventsEnsured: summary.eventsEnsured,
      deliveriesEnsured: summary.deliveriesEnsured,
      cancelledPeriods: summary.cancelledPeriods,
      dispatch: {
        claimed: summary.dispatch.claimed,
        finalized: summary.dispatch.finalized,
        stale: summary.dispatch.stale,
        failed: summary.dispatch.failed,
        errors: summary.dispatch.errors,
      },
    }, { status: 200, headers });
  } catch {
    // Provider/database diagnostics stay in the restricted server-side logs.
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
