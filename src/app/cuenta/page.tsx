import { notFound } from "next/navigation";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { AdminAccountActions, AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const cfg = productConfig();
  if (!cfg) notFound();
  const auth = await userClient(true);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return <main><h1>Ingresá para continuar</h1></main>;
  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || !profile.data) return <main><h1>Acceso no disponible</h1></main>;
  if (profile.data.role !== "admin") return <main><h1>Tu cuenta</h1><p>Perfil: {profile.data.role}</p><form method="post" action="/api/acceso/salir"><button>Salir</button></form></main>;
  const fullName = user.user_metadata?.full_name;
  const email = user.email ?? "Cuenta de CUEVA";
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  const accountActions = <AdminAccountActions ownerOnly={cfg.ownerOnly} />;
  return <AdminDashboard displayName={displayName} email={email} role="Administrador" logo={<BrandMark size={42} />} themePicker={<ThemePicker />} accountActions={accountActions} />;
}
