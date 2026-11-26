import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePushEndpoint } from "./push-subscription.ts";
import { postWebPush, type WebPushConfiguration } from "./web-push-provider.ts";

type Job = {
  job_id: string;
  job_lease: string;
  message_id: string;
  title: string;
  body: string;
  routine: boolean;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

async function pushResult(job: Job, configuration: WebPushConfiguration) {
  const endpoint = parsePushEndpoint(job.endpoint);
  if (!endpoint) return "failed";
  const payload = Buffer.from(JSON.stringify({
    title: job.title,
    body: job.body,
    destination: job.routine ? "/mi-rutina" : "/notificaciones",
    tag: `cueva-notice-${job.message_id}`,
  }));
  try {
    const response = await postWebPush(configuration, { ...job, endpoint }, payload);
    if (response.ok) return "accepted";
    if (response.status === 404 || response.status === 410) return "expired";
    if (response.status === 429) return "rate_limited";
    return response.status >= 500 ? "unknown" : "failed";
  } catch {
    return "unknown";
  }
}

export async function runStudentNoticeWorker(db: SupabaseClient, configuration: WebPushConfiguration) {
  const summary = { processed: 0, accepted: 0, failed: 0, unknown: 0, expired: 0, rateLimited: 0 };
  // Each batch runs in parallel. Leave time to persist outcomes within the function timeout.
  const deadline = Date.now() + 36000;
  for (let batch = 0; batch < 4 && Date.now() < deadline; batch++) {
    const { data, error } = await db.rpc("cueva_claim_student_notice_push");
    if (error || !Array.isArray(data)) throw new Error("No se pudo reservar el envío");
    if (data.length === 0) break;
    await Promise.all((data as Job[]).map(async job => {
      const result = await pushResult(job, configuration);
      const update = await db.rpc("cueva_finish_student_notice_push", {
        p_job: job.job_id, p_lease: job.job_lease, p_result: result,
      });
      summary.processed++;
      if (update.error || update.data !== true) summary.unknown++;
      else if (result === "rate_limited") summary.rateLimited++;
      else summary[result]++;
    }));
  }
  return summary;
}
