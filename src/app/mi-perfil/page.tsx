import Link from "next/link";
import { StudentShell } from "@/components/routines/student-shell";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({ searchParams }: { searchParams?: Promise<{ contrasena?: string }> }) {
  const query = await searchParams;
  if (!productConfig()) return <main className="shell"><h1>Acceso no disponible</h1></main>;
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return <main className="shell"><h1>Ingresá para continuar</h1><Link href="/ingresar">Ingresar</Link></main>;
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "alumno") {
    return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  }
  const fullName = user.user_metadata?.full_name;
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;

  return <StudentShell active="perfil">
    <div className="dash-heading"><div><p className="dash-overline">TU CUENTA</p><h1>Mi perfil</h1><p>Información asociada a tu acceso a CUEVA.</p></div></div>
    <section className="dash-account">
      <div><h2>Datos de acceso</h2>
        <dl>
          {displayName && <div><dt>Nombre</dt><dd>{displayName}</dd></div>}
          <div><dt>Correo electrónico</dt><dd>{user.email ?? "No disponible"}</dd></div>
        </dl>
        <p>Para modificar tus datos personales o solicitar ayuda con tu cuenta, comunicate con el gimnasio.</p>
      </div>
    </section>
    <section className="dash-account">
      <div><h2>Seguridad de la cuenta</h2><p>Para cambiar tu contraseña, confirmá primero la actual.</p></div>
      <PasswordChangeForm />
      {query?.contrasena === "actualizada" && <p role="status">Tu contraseña se actualizó correctamente.</p>}
    </section>
  </StudentShell>;
}
