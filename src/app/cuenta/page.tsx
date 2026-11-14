import { notFound } from "next/navigation";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { AdminAccountActions, AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { StudentShell } from "@/components/routines/student-shell";
import Link from "next/link";
import { pesos } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

type StudentMembershipSummary = {
  active: boolean;
  current: { due_on: string; balance: string; status: "paid" | "overdue" | "pending" } | null;
};

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" });

export default async function AccountPage() {
  const cfg = productConfig();
  if (!cfg) notFound();
  const auth = await userClient(true);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return <main><h1>Ingresá para continuar</h1></main>;
  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || !profile.data) return <main><h1>Acceso no disponible</h1></main>;
  if (profile.data.role !== "admin" && profile.data.role !== "alumno") return <main><h1>Acceso restringido</h1></main>;
  if (profile.data.role === "alumno") {
    const [{ data: membership, error: membershipError }, inboxCount] = await Promise.all([
      auth.rpc("cueva_membership_snapshot"),
      auth.from("cueva_notification_inbox").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    const summary = membership as StudentMembershipSummary | null;
    const due = summary?.current?.due_on
      ? dateFormat.format(new Date(`${summary.current.due_on}T00:00:00Z`))
      : null;
    const balance = summary?.current?.balance;
    return <StudentShell active="cuenta">
      <div className="dash-heading"><div><p className="dash-overline">BIENVENIDO A CUEVA</p><h1>Inicio</h1><p>{user.email}</p></div><span className="dash-role">Alumno</span></div>
      <section className="dash-account">
        <div><h2>Tu entrenamiento</h2><p>Consultá la planificación publicada por el gimnasio.</p><Link className="routine-account-link" href="/mi-rutina">Ver entrenamiento →</Link></div>
      </section>
      <section className="dash-account">
        <div><h2>Tu membresía</h2>
          {membershipError || !summary
            ? <p>El estado de tu membresía no está disponible por el momento.</p>
            : <><p>{summary.active ? "Membresía activa" : "Membresía inactiva"}</p>
              {summary.current ? <dl>
                <div><dt>Vencimiento del período</dt><dd>{due}</dd></div>
                <div><dt>Saldo del período</dt><dd>{pesos(balance ?? "0")}</dd></div>
              </dl> : <p>No hay un período de cuota actual registrado.</p>}
            </>}
          <Link className="routine-account-link" href="/mi-membresia">Ver mi membresía →</Link>
        </div>
      </section>
      <section className="dash-account"><div><h2>Notificaciones</h2>
        <p>{inboxCount.error ? "Tus avisos no están disponibles por el momento." : `${inboxCount.count ?? 0} avisos sin leer`}</p>
        <Link className="routine-account-link" href="/notificaciones">Ver notificaciones →</Link>
      </div></section>
      <section className="dash-account"><div><h2>Mi perfil</h2><p>Consultá la información asociada a tu cuenta.</p><Link className="routine-account-link" href="/mi-perfil">Ver mi perfil →</Link></div></section>
    </StudentShell>;
  }
  const fullName = user.user_metadata?.full_name;
  const email = user.email ?? "Cuenta de CUEVA";
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  const accountActions = <AdminAccountActions ownerOnly={cfg.ownerOnly} />;
  return <AdminDashboard displayName={displayName} email={email} role="Administrador" logo={<BrandMark size={42} />} themePicker={<ThemePicker />} accountActions={accountActions} />;
}
