import Link from "next/link";
import { StudentShell } from "@/components/routines/student-shell";
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
  const dateFormatter = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const inboxItems: NotificationInboxItem[] | null = inboxResult.error ? null : (inboxResult.data ?? []).map(item => ({
    ...item,
    created_at_label: dateFormatter.format(new Date(item.created_at)),
  }));

  return <StudentShell active="notificaciones">
    <div className="dash-heading"><div><p className="dash-overline">TU ACTIVIDAD</p><h1>Notificaciones</h1><p>Recordatorios y novedades de tu cuenta.</p></div></div>
    <PushNotificationSettings />
    <NotificationInbox items={inboxItems} />
  </StudentShell>;
}
