import Link from "next/link";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { StudentShell } from "@/components/routines/student-shell";

export const dynamic = "force-dynamic";
export default async function MyRoutine() {
  if (!productConfig()) return <main className="shell"><h1>Acceso no disponible</h1></main>;
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return <main className="shell"><h1>Ingresá para continuar</h1><Link href="/ingresar">Ingresar</Link></main>;
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.data?.role !== "alumno" || profile.error) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  // RLS uses the captured fiche–Auth UUID binding and exposes only the latest
  // published revision. No email lookup and no service-role client.
  const result = await client.from("cueva_routine_publications").select("content,published_at").order("draft_revision", { ascending: false }).limit(1).maybeSingle();
  return <StudentShell active="rutina"><div className="dash-heading"><div><p className="dash-overline">TU ENTRENAMIENTO</p><h1>Mi rutina</h1></div></div>{result.error ? <section className="dash-account"><h2>No pudimos cargar tu rutina</h2><p>Intentá nuevamente en unos instantes.</p><Link href="/mi-rutina">Reintentar</Link></section> : result.data ? <article className="routine-reading"><p>Publicada el <time dateTime={result.data.published_at}>{new Date(result.data.published_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</time></p><pre>{result.data.content}</pre></article> : <section className="dash-account"><h2>Tu rutina está en preparación</h2><p>Cuando el gimnasio la publique, vas a poder consultarla acá.</p></section>}</StudentShell>;
}
