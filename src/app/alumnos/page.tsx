import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { studentSearchFilter } from "@/lib/students/search";
import { buenosAiresDate } from "@/lib/students/date";
import { productConfig } from "@/lib/product-auth/server";
import { StudentForm, type Student } from "@/components/students/student-form";
import { AdminAccountActions, AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

export const dynamic = "force-dynamic";
export default async function Students({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><p>Esta sección requiere una cuenta de administrador habilitada.</p><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const email = user.email ?? "Cuenta de CUEVA";
  const fullName = user.user_metadata?.full_name;
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const id = typeof params.id === "string" && /^[0-9a-f-]{36}$/i.test(params.id) ? params.id : null;
  let query = client.from("cueva_students").select("id,first_name,last_name,email,dni,joined_on,active").order("last_name").order("id").limit(101);
  if (id) query = query.eq("id", id);
  if (q) query = query.or(studentSearchFilter(q));
  const { data, error } = await query;
  const rows = (data ?? []) as Student[];
  const student = rows[0];
  const defaultJoinedOn = buenosAiresDate();
  return <AdminShell displayName={displayName} email={email} role="Administrador" logo={<BrandMark size={42} />} themePicker={<ThemePicker />} active="alumnos" accountActions={<AdminAccountActions ownerOnly={productConfig()!.ownerOnly} />}>
    <Link href="/alumnos">← Alumnos</Link>
    <div className="dash-heading"><h1>{params.nuevo ? "Nuevo alumno" : id ? "Ficha del alumno" : "Alumnos"}</h1>{!id && !params.nuevo && <Link className="dash-role" href="/alumnos?nuevo=1">+ Nuevo alumno</Link>}</div>
    {error ? <section className="dash-account"><h2>Gestión no disponible</h2><p>No pudimos cargar los alumnos. Intentá nuevamente.</p><Link href="/alumnos">Reintentar</Link></section>
      : params.nuevo ? <StudentForm defaultJoinedOn={defaultJoinedOn} />
      : id ? !student ? <p>No se encontró la ficha.</p>
        : params.editar ? <StudentForm student={student} defaultJoinedOn={defaultJoinedOn} />
          : <section className="dash-account"><div><h2>{student.first_name} {student.last_name}</h2>{params.guardado && <p role="status">Ficha guardada correctamente.</p>}<p>{student.email}</p><p>DNI: {student.dni ?? "No informado"}</p><p>Fecha de alta: {student.joined_on}</p><p>Estado administrativo: {student.active ? "Activo" : "Inactivo"}</p><p>Acceso a la aplicación: no se vincula automáticamente con esta ficha.</p><Link href={`/alumnos?id=${id}&editar=1`}>Editar ficha</Link><p>Pagos, rutina y comprobantes: próximamente.</p></div></section>
      : <>
        <form className="student-search"><label>Buscar alumnos<input name="q" defaultValue={q} placeholder="Nombre, apellido, correo o DNI" /></label><button>Buscar</button></form>
        <p>{q ? "Resultados de búsqueda" : "Fichas administrativas"} · Estado independiente de los pagos.</p>
        {!rows.length ? <section className="dash-account"><h2>{q ? "No encontramos coincidencias" : "Todavía no hay alumnos"}</h2><p>{q ? "Probá con otro nombre, correo o DNI." : "Registrá la primera ficha desde Nuevo alumno."}</p></section>
          : <ul className="student-list">{rows.slice(0, 100).map(row => <li key={row.id}><Link href={`/alumnos?id=${row.id}`}><strong>{row.last_name}, {row.first_name}</strong><span>{row.email}</span><small>{row.active ? "Activo" : "Inactivo"}</small></Link></li>)}</ul>}
        {rows.length > 100 && <p>Mostramos los primeros 100 resultados. Refiná la búsqueda para encontrar una ficha.</p>}
      </>}
  </AdminShell>;
}
