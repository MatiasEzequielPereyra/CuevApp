import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { uuid, type Note, type Publication, type Template } from "@/lib/routines/types";
import { NoteEditor } from "@/components/routines/note-editor";
import { RoutineShell } from "@/components/routines/routine-shell";
export async function StudentRoutine({ id }: { id: string }) {
  const client = await studentAdmin();
  if (!client || !uuid.test(id)) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  const [{ data: { user } }, student, draft, publication, templates, draftText, publicationText, templateTexts] = await Promise.all([
    client.auth.getUser(), client.from("cueva_students").select("first_name,last_name").eq("id",id).maybeSingle(),
    client.from("cueva_routine_drafts").select("content,revision,plan").eq("student_id",id).maybeSingle(),
    client.from("cueva_routine_publications").select("id,content,plan,draft_revision,published_at").eq("student_id",id).order("draft_revision",{ascending:false}).limit(1).maybeSingle(),
    client.from("cueva_routine_templates").select("id,title,content,revision,plan").order("title").order("id").limit(200),
    client.from("cueva_routine_text_drafts").select("format,text_content,block_content,mentions,revision").eq("kind","draft").eq("owner_id",id).maybeSingle(),
    client.from("cueva_routine_text_publications").select("publication_id,format,text_content,block_content,mentions").eq("student_id",id),
    client.from("cueva_routine_text_drafts").select("owner_id,format,text_content,block_content,mentions").eq("kind","template"),
  ]);
  const draftInitial = draft.data ? {
    ...draft.data,
    content: draftText.data?.block_content ?? draft.data.content,
    format: draftText.data?.format ?? "blocks",
    text_content: draftText.data?.text_content ?? "",
    mentions: draftText.data?.mentions ?? [],
  } : { content: "", revision: 0, format: "blocks" as const, text_content: "", mentions: [] };
  const publicationInitial = publication.data ? {
    ...publication.data,
    content: publicationText.data?.find(item => item.publication_id === publication.data?.id)?.block_content ?? publication.data.content,
    format: publicationText.data?.find(item => item.publication_id === publication.data?.id)?.format ?? "blocks",
    text_content: publicationText.data?.find(item => item.publication_id === publication.data?.id)?.text_content ?? "",
    mentions: publicationText.data?.find(item => item.publication_id === publication.data?.id)?.mentions ?? [],
  } : null;
  const templateMap = new Map((templateTexts.data ?? []).map(item => [item.owner_id, item]));
  const templateInitial = (templates.data ?? []).map(item => {
    const text = templateMap.get(item.id);
    return { ...item, content: text?.block_content ?? item.content, format: text?.format ?? "blocks", text_content: text?.text_content ?? "", mentions: text?.mentions ?? [] };
  });
  return <RoutineShell email={user?.email ?? "Cuenta de CUEVA"}><Link href={`/alumnos?id=${id}`}>← Ficha del alumno</Link><div className="dash-heading"><div><p className="dash-overline">PLANIFICACIÓN DEL ALUMNO</p><h1>Rutina de {student.data?.first_name} {student.data?.last_name}</h1></div></div>
    {student.error || draft.error || publication.error || templates.error || draftText.error || publicationText.error || templateTexts.error ? <p role="alert">No pudimos cargar la rutina. Reintentá.</p> : !student.data ? <p>No se encontró la ficha.</p> : <><NoteEditor key={id} id={id} initial={draftInitial as Note} publication={publicationInitial as Publication | null} templates={templateInitial as Template[]}/></>}
  </RoutineShell>;
}
