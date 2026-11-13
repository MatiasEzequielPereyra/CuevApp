import { notFound } from "next/navigation";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import styles from "./admin-alerts.module.css";
import { NotificationScheduleSettings } from "@/components/notifications/notification-schedule-settings";

export const dynamic = "force-dynamic";

type AdminAlert = {
  id: string;
  alert_type: "retries_exhausted" | "provider_outcome_unknown";
  student_name: string;
  period_month: string;
  reminder_days: 1 | 5;
  channel: "email" | "internal" | "push";
  attempt_count: 1 | 2 | 3 | 4 | 5;
  failed_at: string;
};

const channelLabels: Record<AdminAlert["channel"], string> = {
  email: "Correo electrónico",
  internal: "Bandeja del alumno",
  push: "Notificación push",
};

function periodLabel(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export default async function AdminAlertsPage() {
  const cfg = productConfig();
  if (!cfg) notFound();

  const auth = await userClient(true);
  const { data: { user }, error: userError } = await auth.auth.getUser();
  if (userError || !user) notFound();

  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "admin") notFound();

  const [{ data, error }, { data: settings, error: settingsError }] = await Promise.all([
    auth
      .from("cueva_notification_admin_alerts")
      .select("id,alert_type,student_name,period_month,reminder_days,channel,attempt_count,failed_at")
      .order("failed_at", { ascending: false })
      .limit(100),
    auth.from("cueva_notification_settings").select("send_time").eq("singleton", true).maybeSingle(),
  ]);

  const alerts = (data ?? []) as AdminAlert[];
  const initialSendTime = settingsError || typeof settings?.send_time !== "string"
    ? null
    : settings.send_time.slice(0, 5);
  const displayName = typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim()
    : user.email ?? "Administrador";

  return (
    <AdminShell
      active="alertas"
      displayName={displayName}
      email={user.email ?? "Cuenta de CUEVA"}
      role="Administrador"
      logo={<BrandMark size={42} />}
      themePicker={<ThemePicker />}
    >
      <NotificationScheduleSettings initialTime={initialSendTime} />

      <div className={styles.heading}>
        <div>
          <p className="dash-overline"><span /> OPERACIÓN DEL GIMNASIO</p>
          <h1>Alertas operativas</h1>
          <p>Entregas que agotaron sus reintentos o necesitan conciliación con el proveedor.</p>
        </div>
        <span className={styles.count}>{alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}</span>
      </div>

      {error ? (
        <section className={styles.empty} role="status">
          <h2>No pudimos cargar las alertas</h2>
          <p>Intentá nuevamente más tarde. El registro operativo permanece protegido.</p>
        </section>
      ) : alerts.length === 0 ? (
        <section className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">✓</span>
          <h2>No hay alertas pendientes de revisión</h2>
          <p>Cuando una entrega agote sus intentos o tenga un resultado externo incierto, aparecerá acá.</p>
        </section>
      ) : (
        <section className={styles.list} aria-label="Alertas de notificaciones">
          {alerts.map(alert => (
            <article className={styles.card} key={alert.id}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.eyebrow}>{alert.alert_type === "provider_outcome_unknown" ? "RESULTADO DEL PROVEEDOR INCIERTO" : "REINTENTOS AGOTADOS"}</span>
                  <h2>{alert.student_name}</h2>
                </div>
                <span className={styles.status}>{alert.alert_type === "provider_outcome_unknown" ? "Requiere conciliación" : "Fallido definitivo"}</span>
              </div>
              <div className={styles.details}>
                <span><strong>Período</strong>{periodLabel(alert.period_month)}</span>
                <span><strong>Recordatorio</strong>{alert.reminder_days} {alert.reminder_days === 1 ? "día" : "días"} antes</span>
                <span><strong>Canal</strong>{channelLabels[alert.channel]}</span>
                <span><strong>Intentos</strong>{alert.attempt_count} de 5</span>
              </div>
              <p className={styles.date}>{alert.alert_type === "provider_outcome_unknown" ? "No se reintentará automáticamente para evitar un posible duplicado. Verificá el registro del proveedor." : "Fecha del fallo:"} {dateLabel(alert.failed_at)}</p>
            </article>
          ))}
        </section>
      )}
    </AdminShell>
  );
}
