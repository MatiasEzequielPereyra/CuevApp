import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { studentSearchFilter } from "@/lib/students/search";
import { uuid, type Note, type Publication, type Template } from "@/lib/routines/types";
import { NoteEditor } from "@/components/routines/note-editor";
import { RoutineShell } from "@/components/routines/routine-shell";

export const dynamic = "force-dynamic";
export default async function Routines({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  const params = await searchParams;
  const id = typeof params.alumno === "string" && uuid.test(params.alumno) ? params.alumno : null;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  let query = client.from("cueva_students").select("id,first_name,last_name").order("last_name").order("id").limit(101);
  if (id) query = query.eq("id", id);
  if (q && !id) query = query.or(studentSearchFilter(q));
  const students = await query;
  const [draft, publication, templates] = id ? await Promise.all([
    client.from("cueva_routine_drafts").select("content,revision").eq("student_id", id).maybeSingle(),
    client.from("cueva_routine_publications").select("id,content,draft_revision,published_at").eq("student_id", id).order("draft_revision", { ascending: false }).limit(1).maybeSingle(),
    client.from("cueva_routine_templates").select("id,title,content,revision").order("title").limit(200),
  ]) : [null, null, null];
  const failed = students.error || draft?.error || publication?.error || templates?.error;
  const student = students.data?.[0];
  return <RoutineShell email={user?.email ?? "Cuenta de CUEVA"}>
    <div className="dash-heading"><div><p className="dash-overline">PLANIFICACIÓN</p><h1>Rutinas</h1><p>Una nota por alumno. Publicá cuando esté lista.</p></div><Link className="dash-role" href="/rutinas/plantillas">Plantillas</Link></div>
    {failed ? <section className="dash-account"><h2>No pudimos cargar las rutinas</h2><p>Intentá nuevamente. La migración puede estar pendiente.</p><Link href="/rutinas">Reintentar</Link></section>
      : id ? student ? <><div className="routine-student-heading"><h2>{student.first_name} {student.last_name}</h2><Link href={`/alumnos?id=${id}`}>Ver ficha</Link><Link href="/rutinas">Cambiar de alumno</Link></div><NoteEditor key={id} id={id} initial={(draft?.data as Note | null) ?? { content: "", revision: 0 }} publication={publication?.data as Publication | null} templates={(templates?.data ?? []) as Template[]}/></> : <p>No se encontró la ficha.</p>
      : <><form className="student-search"><label>Buscar alumno<input name="q" defaultValue={q} placeholder="Nombre, apellido, correo o DNI"/></label><button>Buscar</button></form><h2 className="routine-list-heading">Elegí un alumno</h2>{!students.data?.length ? <p>{q ? "No encontramos coincidencias." : "Todavía no hay alumnos registrados."}</p> : <ul className="student-list">{students.data.slice(0, 100).map(row => <li key={row.id}><Link href={`/rutinas?alumno=${row.id}`}><strong>{row.last_name}, {row.first_name}</strong><span>Abrir rutina →</span></Link></li>)}</ul>}{(students.data?.length ?? 0) > 100 && <p>Mostramos los primeros 100 alumnos. Refiná la búsqueda.</p>}</>}
  </RoutineShell>;
}
