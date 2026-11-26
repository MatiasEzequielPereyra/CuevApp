import { serviceClient, productConfig } from "@/lib/product-auth/server";
import { isAuthorizedNotificationWorkerRequest } from "@/lib/notifications/worker-endpoint-auth";
import { isWebPushConfigurationAvailable } from "@/lib/notifications/web-push-provider";
import { runStudentNoticeWorker } from "@/lib/notifications/student-notice-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!isAuthorizedNotificationWorkerRequest(request, process.env.CUEVA_STUDENT_NOTICES_SECRET)) {
    return Response.json({ ok: false }, { status: 403, headers });
  }
  const configuration = {
    publicKey: process.env.CUEVA_VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.CUEVA_VAPID_PRIVATE_KEY ?? "",
    subject: process.env.CUEVA_VAPID_SUBJECT ?? "",
  };
  if (!productConfig() || !isWebPushConfigurationAvailable(configuration)) {
    return Response.json({ ok: false }, { status: 503, headers });
  }
  try {
    const summary = await runStudentNoticeWorker(serviceClient(), configuration);
    return Response.json({ ok: true, ...summary }, { headers });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
