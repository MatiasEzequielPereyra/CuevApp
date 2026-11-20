import { notFound, redirect } from "next/navigation";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { completeSelfRegistration } from "@/lib/product-auth/self-registration";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { StudentShell } from "@/components/routines/student-shell";
import { StudentHome } from "@/components/routines/student-home";

export const dynamic = "force-dynamic";

type StudentMembershipSummary = {
  active: boolean;
  current: { due_on: string; balance: string; status: "paid" | "overdue" | "pending" } | null;
};

export default async function AccountPage() {
  const cfg = productConfig();
  if (!cfg) notFound();
  const auth = await userClient(true);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) redirect("/ingresar");
  let profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  // A new user may have confirmed the email on another device, without
  // completing the one-time callback. Complete only their own new enrollment.
  if (!profile.error && !profile.data && cfg.selfRegistrationEnabled && user.email_confirmed_at) {
    const enrollment = await completeSelfRegistration(auth, user.id);
    if (enrollment === "needs_review" || enrollment === "invalid" || enrollment === "error") {
      return <main className="shell"><h1>Tu registro está pendiente</h1>
        <p>Tu correo está confirmado. Si ya existe una ficha con ese correo, el gimnasio debe verificar la vinculación. No hace falta solicitar otra invitación.</p>
        <a href="/ingresar">Volver al ingreso</a>
      </main>;
    }
    if (enrollment === "created") {
      profile = await auth.from("cueva_profiles").select("role").maybeSingle();
    }
  }
  if (profile.error || !profile.data) return <main><h1>Acceso no disponible</h1></main>;
  if (profile.data.role !== "admin" && profile.data.role !== "alumno") return <main><h1>Acceso restringido</h1></main>;
  if (profile.data.role === "alumno") {
    const [{ data: membership, error: membershipError }, inboxCount] = await Promise.all([
      auth.rpc("cueva_membership_snapshot"),
      auth.from("cueva_notification_inbox").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    const name = user.user_metadata?.full_name;
    return <StudentShell active="cuenta">
      <StudentHome name={typeof name === "string" ? name.trim().split(/\s+/)[0] : undefined}
        membership={membershipError ? null : membership as StudentMembershipSummary | null}
        unread={inboxCount.error ? null : inboxCount.count ?? 0} />
    </StudentShell>;
  }
  const fullName = user.user_metadata?.full_name;
  const email = user.email ?? "Cuenta de CUEVA";
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  return <AdminDashboard displayName={displayName} email={email} role="Administrador" logo={<BrandMark size={42} />} themePicker={<ThemePicker />} />;
}
