import Link from "next/link";
import { StudentPageHeading, StudentShell } from "@/components/routines/student-shell";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({ searchParams }: { searchParams?: Promise<{ contrasena?: string | string[] }> } = {}) {
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
  const initials = displayName?.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase("es-AR");

  return <StudentShell active="perfil">
    <StudentPageHeading title="Mi perfil" />
    <section className="student-card student-profile" aria-labelledby="student-profile-title">
      <div className="student-profile-header">
        <span className="student-profile-avatar" aria-hidden="true">{initials || "C"}</span>
        <div><h2 id="student-profile-title">{displayName ?? "Tu cuenta"}</h2><p>Alumno de CUEVA</p></div>
      </div>
      <dl className="student-profile-data">
        <div><dt>Correo electrónico de acceso</dt><dd>{user.email ?? "No disponible"}</dd></div>
      </dl>
      <p>Si necesitás actualizar tus datos, comunicate con el gimnasio.</p>
    </section>
    <section className="student-card student-profile" aria-labelledby="student-security-title">
      <div><h2 id="student-security-title">Seguridad de la cuenta</h2><p>Para cambiar tu contraseña, confirmá primero la actual.</p></div>
      <PasswordChangeForm />
      {query?.contrasena === "actualizada" && <p role="status">Tu contraseña se actualizó correctamente.</p>}
    </section>
  </StudentShell>;
}
