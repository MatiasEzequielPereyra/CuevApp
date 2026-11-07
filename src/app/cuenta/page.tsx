import { notFound } from "next/navigation";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { AdminAccountActions, AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { StudentShell } from "@/components/routines/student-shell";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const cfg = productConfig();
  if (!cfg) notFound();
  const auth = await userClient(true);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return <main><h1>Ingresá para continuar</h1></main>;
  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || !profile.data) return <main><h1>Acceso no disponible</h1></main>;
  if (profile.data.role !== "admin") return <StudentShell><div className="dash-heading"><div><p className="dash-overline">BIENVENIDO A CUEVA</p><h1>Tu cuenta</h1><p>{user.email}</p></div><span className="dash-role">Alumno</span></div><section className="dash-account"><div><h2>Tu entrenamiento</h2><p>Consultá la planificación publicada por el gimnasio.</p><Link className="routine-account-link" href="/mi-rutina">Mi rutina →</Link></div></section><section className="dash-account"><div><h2>Tu membresía</h2><p>Consultá tu cuota, vencimiento e historial de pagos.</p><Link className="routine-account-link" href="/mi-membresia">Mi Membresía →</Link></div></section></StudentShell>;
  const fullName = user.user_metadata?.full_name;
  const email = user.email ?? "Cuenta de CUEVA";
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  const accountActions = <AdminAccountActions ownerOnly={cfg.ownerOnly} />;
  return <AdminDashboard displayName={displayName} email={email} role="Administrador" logo={<BrandMark size={42} />} themePicker={<ThemePicker />} accountActions={accountActions} />;
}
