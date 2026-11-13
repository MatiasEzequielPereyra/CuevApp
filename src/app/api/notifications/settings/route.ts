import { productConfig, userClient } from "@/lib/product-auth/server";
import { createNotificationScheduleHandlers } from "@/lib/notifications/schedule-route-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<boolean> {
  if (!productConfig()) return false;
  const auth = await userClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return false;
  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  return !profile.error && profile.data?.role === "admin";
}

const handlers = createNotificationScheduleHandlers({
  sameOrigin(request) {
    const configuration = productConfig();
    return !!configuration && request.headers.get("origin") === configuration.origin;
  },
  requireAdmin,
  async updateSchedule(sendTime) {
    const auth = await userClient();
    const { data, error } = await auth.rpc("cueva_update_notification_schedule", {
      p_send_time: sendTime,
    });
    if (error || typeof data !== "string") return null;
    return data;
  },
});

export const PATCH = handlers.PATCH;
