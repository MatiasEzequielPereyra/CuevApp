import { randomUUID } from "node:crypto";
import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { NoteEditor } from "@/components/routines/note-editor";
import { RoutineShell } from "@/components/routines/routine-shell";
import { uuid, type Template } from "@/lib/routines/types";

export const dynamic = "force-dynamic";
export default async function Templates({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  const params = await searchParams;
  const id = typeof params.id === "string" && uuid.test(params.id) ? params.id : null;
  const rawPage = typeof params.pagina === "string" ? Number(params.pagina) : 0;
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 10000 ? rawPage : 0;
  const result = id ? await client.from("cueva_routine_templates").select("id,title,content,revision,plan").eq("id", id) : await client.from("cueva_routine_templates").select("id,title,revision").order("title").order("id").range(page * 100, page * 100 + 100);
  const selected = result.data?.[0] as Template | undefined;
  return <RoutineShell email={user?.email ?? "Cuenta de CUEVA"}>
    <Link href="/ejercicios">Biblioteca de ejercicios</Link><div className="dash-heading"><h1>Catálogo de rutinas</h1>{!id && !params.nueva && <Link className="dash-role" href="/rutinas/plantillas?nueva=1">+ Nueva plantilla</Link>}</div>
    {result.error ? <p role="alert">No pudimos cargar las plantillas. Intentá nuevamente.</p> : params.nueva ? <NoteEditor id={randomUUID()} initial={{ title: "", content: "", revision: 0 }} template/>
      : id ? selected ? <><Link href="/rutinas/plantillas">Todas las plantillas</Link><NoteEditor key={id} id={id} initial={selected} template/></> : <p>No se encontró la plantilla.</p>
      : <><p>Días, bloques y objetivos reutilizables. Cada aplicación es una copia independiente.</p>{!result.data?.length ? <section className="dash-account"><h2>Todavía no hay plantillas</h2><p>Creá una para empezar una rutina más rápido.</p></section> : <ul className="student-list">{result.data.slice(0, 100).map(row => <li key={row.id}><Link href={`/rutinas/plantillas?id=${row.id}`}><strong>{row.title}</strong><span>Editar plantilla →</span></Link></li>)}</ul>}<nav aria-label="Páginas de plantillas">{page > 0 && <Link href={`/rutinas/plantillas?pagina=${page - 1}`}>Página anterior</Link>}{(result.data?.length ?? 0) > 100 && <Link href={`/rutinas/plantillas?pagina=${page + 1}`}>Más plantillas</Link>}</nav></>}
  </RoutineShell>;
}
