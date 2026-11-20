import Link from "next/link";
import { cookies } from "next/headers";
import { StudentPageHeading, StudentShell } from "@/components/routines/student-shell";
import { PasswordChangeForm } from "@/components/auth/password-change-form";
import { StudentEmailChangeForm } from "@/components/auth/student-email-change-form";
import { emailChangeCookie, matchesEmailChange, productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

type ProfileQuery = { correo?: string | string[]; contrasena?: string | string[] };
export default async function StudentProfilePage({ searchParams }: { searchParams?: Promise<ProfileQuery> } = {}) {
  const query = await searchParams;
  const configuration = productConfig();
  if (!configuration) return <main className="shell"><h1>Acceso no disponible</h1></main>;
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
  const confirmedEmailChange = query?.correo === "confirmado" && !!user.email_confirmed_at && !!user.email
    && matchesEmailChange((await cookies()).get(emailChangeCookie)?.value, configuration.serviceKey, user.id, user.email);

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
      <p>Tu nombre, apellido y DNI son administrados por el gimnasio.</p>
    </section>
    <section className="student-card student-profile" aria-labelledby="student-email-title">
      <div><h2 id="student-email-title">Correo de acceso</h2><p>Tu correo actual sigue vigente hasta completar las confirmaciones requeridas. Según la configuración de seguridad, puede que también debas confirmar desde tu correo actual.</p></div>
      <StudentEmailChangeForm currentEmail={user.email ?? ""} />
      {(query?.correo === "pendiente" || query?.correo === "confirmado") && user.new_email && !confirmedEmailChange
        && <p role="status">Tu correo actual sigue activo hasta completar las confirmaciones requeridas.</p>}
      {confirmedEmailChange && <p role="status">Tu nuevo correo fue confirmado y ya está actualizado en tu cuenta.</p>}
      {query?.correo === "igual" && <p role="status">Ese correo ya es el que utilizás actualmente.</p>}
    </section>
    <section className="student-card student-profile" aria-labelledby="student-security-title">
      <div><h2 id="student-security-title">Seguridad de la cuenta</h2><p>Para cambiar tu contraseña, confirmá primero la actual.</p></div>
      <PasswordChangeForm gateUntilValid />
      {query?.contrasena === "actualizada" && <p role="status">Tu contraseña se actualizó correctamente.</p>}
    </section>
  </StudentShell>;
}
