import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { ThemePicker } from "@/components/theme/theme-picker";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

export default async function AdminPersonalAccount({ searchParams }: { searchParams: Promise<{ contrasena?: string | string[] }> }) {
  if (!productConfig()) notFound();
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/ingresar");
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || !profile.data) return <main><h1>Acceso no disponible</h1></main>;
  if (profile.data.role === "alumno") redirect("/mi-perfil");
  if (profile.data.role !== "admin") return <main><h1>Acceso restringido</h1></main>;

  const query = await searchParams;
  const fullName = user.user_metadata?.full_name;
  const email = user.email ?? "Cuenta de CUEVA";
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  const actions = (
    <section aria-labelledby="admin-password-heading">
      <h3 id="admin-password-heading">Seguridad de la cuenta</h3>
      <p>Para cambiar tu contraseña, confirmá primero la actual.</p>
      <PasswordChangeForm />
      {query?.contrasena === "actualizada" && <p role="status">Tu contraseña se actualizó correctamente.</p>}
    </section>
  );

  return (
    <AdminShell displayName={displayName} email={email} role="Administrador"
      logo={<BrandMark size={42} />} themePicker={<ThemePicker />}
      accountActions={actions} active="cuenta">
      <h1>Mi cuenta</h1>
    </AdminShell>
  );
}
