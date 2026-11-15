import { StudentPlan } from "@/components/routines/student-plan";
import type { Plan } from "@/lib/routines/types";
import Link from "next/link";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { StudentShell } from "@/components/routines/student-shell";

import "./mi-rutina.css";

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
  const result = await client.from("cueva_routine_publications").select("content,plan,published_at").order("draft_revision", { ascending: false }).limit(1).maybeSingle();
  const publication = result.data;
  const plan = publication?.plan as Plan | null | undefined;
  const videos = plan ? await client.rpc("cueva_my_routine_video_ids") : null;
  const videoIds: string[] = !videos?.error && Array.isArray(videos?.data) ? videos.data : [];

  return (
    <StudentShell active="rutina">
      <div className="my-routine">
        <header className="my-routine-heading">
          <h1>Mi rutina</h1>
          {publication && (
            <p>Publicada el <time dateTime={publication.published_at}>{new Date(publication.published_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</time></p>
          )}
        </header>
        {result.error ? (
          <section className="my-routine-panel">
            <h2>No pudimos cargar tu rutina</h2>
            <p>Intentá nuevamente en unos instantes.</p>
            <a href="/mi-rutina">Reintentar</a>
          </section>
        ) : publication ? (
          <>
            {videos?.error && <p role="status">No pudimos consultar los videos. Podés seguir tu rutina o <a href="/mi-rutina">reintentar</a>.</p>}
            {plan && <StudentPlan key={publication.published_at} plan={plan} videoIds={videoIds} />}
            {publication.content && <section className="my-routine-panel my-routine-notes"><h2>Observaciones</h2><p>{publication.content}</p></section>}
            {!plan && !publication.content && <p>La publicación todavía no tiene ejercicios ni observaciones.</p>}
          </>
        ) : (
          <section className="my-routine-panel">
            <h2>Tu rutina está en preparación</h2>
            <p>Cuando el gimnasio la publique, vas a poder consultarla acá.</p>
          </section>
        )}
      </div>
    </StudentShell>
  );
}
