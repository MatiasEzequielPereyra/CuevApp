import Link from "next/link";
import { StudentShell } from "@/components/routines/student-shell";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({ searchParams }: { searchParams?: Promise<{ correo?: string }> }) {
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
  const query = await searchParams;

  return <StudentShell active="perfil">
    <div className="dash-heading"><div><p className="dash-overline">TU CUENTA</p><h1>Mi perfil</h1><p>Información asociada a tu acceso a CUEVA.</p></div></div>
    <section className="dash-account">
      <div><h2>Datos de acceso</h2>
        <dl>
          {displayName && <div><dt>Nombre</dt><dd>{displayName}</dd></div>}
          <div><dt>Correo electrónico actual</dt><dd>{user.email ?? "No disponible"}</dd></div>
        </dl>
        <p>Tu nombre, apellido y DNI son administrados por el gimnasio. Para cambiar el correo, confirmá la nueva dirección desde el mensaje que te enviaremos. El correo actual seguirá vigente hasta completar la verificación.</p>
      </div>
      <form className="access-fields" method="post" action="/api/acceso/cambiar-correo">
        <label htmlFor="student-new-email">Nuevo correo electrónico</label>
        <input id="student-new-email" type="email" name="email" autoComplete="email" maxLength={254} placeholder="nombre@ejemplo.com" required />
        <button type="submit">Enviar verificación</button>
      </form>
      {query?.correo === "pendiente" && <p role="status">Enviamos las instrucciones de verificación. Tu correo actual sigue activo hasta que confirmes el nuevo.</p>}
      {query?.correo === "confirmado" && <p role="status">Tu nuevo correo fue confirmado y ya está actualizado en tu cuenta.</p>}
      {query?.correo === "igual" && <p role="status">Ese correo ya es el que utilizás actualmente.</p>}
    </section>
  </StudentShell>;
}
