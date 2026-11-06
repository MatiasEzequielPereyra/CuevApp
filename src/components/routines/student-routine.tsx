import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { uuid, type Note, type Publication, type Template } from "@/lib/routines/types";
import { NoteEditor } from "@/components/routines/note-editor";
import { RoutineShell } from "@/components/routines/routine-shell";
export async function StudentRoutine({ id }: { id: string }) {
  const client = await studentAdmin();
  if (!client || !uuid.test(id)) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  const [{ data: { user } }, student, draft, publication, templates] = await Promise.all([
    client.auth.getUser(), client.from("cueva_students").select("first_name,last_name").eq("id",id).maybeSingle(),
    client.from("cueva_routine_drafts").select("content,revision,plan").eq("student_id",id).maybeSingle(),
    client.from("cueva_routine_publications").select("id,content,plan,draft_revision,published_at").eq("student_id",id).order("draft_revision",{ascending:false}).limit(1).maybeSingle(),
    client.from("cueva_routine_templates").select("id,title,content,revision,plan").order("title").order("id").limit(200),
  ]);
  return <RoutineShell email={user?.email ?? "Cuenta de CUEVA"}><Link href={`/alumnos?id=${id}`}>← Ficha del alumno</Link><div className="dash-heading"><div><p className="dash-overline">PLANIFICACIÓN DEL ALUMNO</p><h1>Rutina de {student.data?.first_name} {student.data?.last_name}</h1></div></div>
    {student.error || draft.error || publication.error || templates.error ? <p role="alert">No pudimos cargar la rutina. Reintentá.</p> : !student.data ? <p>No se encontró la ficha.</p> : <><NoteEditor key={id} id={id} initial={(draft.data as Note | null) ?? {content:"",revision:0}} publication={publication.data as Publication | null} templates={(templates.data ?? []) as Template[]}/></>}
  </RoutineShell>;
}
