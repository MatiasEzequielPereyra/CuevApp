import Link from "next/link";
import { StudentPageHeading, StudentShell } from "@/components/routines/student-shell";
import { NotificationInbox, type NotificationInboxItem } from "@/components/notifications/notification-inbox";
import { PushNotificationSettings } from "@/components/notifications/push-notification-settings";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  if (!productConfig()) return <main className="shell"><h1>Acceso no disponible</h1></main>;
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return <main className="shell"><h1>Ingresá para continuar</h1><Link href="/ingresar">Ingresar</Link></main>;
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "alumno") {
    return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  }
  const inboxResult = await client.from("cueva_notification_inbox")
    .select("id,title,body,created_at,read_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const inboxItems = inboxResult.error ? null : (inboxResult.data ?? []) as NotificationInboxItem[];

  return <StudentShell active="notificaciones">
    <StudentPageHeading title="Notificaciones"><p>Recordatorios y novedades de tu cuenta.</p></StudentPageHeading>
    <div className="student-notifications">
      <NotificationInbox items={inboxItems} />
      <PushNotificationSettings />
    </div>
  </StudentShell>;
}
