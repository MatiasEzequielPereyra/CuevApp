import { StudentPlan } from "@/components/routines/student-plan";
import type { ReactNode } from "react";
import type { Plan } from "@/lib/routines/types";
import Link from "next/link";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { StudentPageHeading, StudentShell } from "@/components/routines/student-shell";

import "./mi-rutina.css";

export const dynamic = "force-dynamic";

type MentionedExercise = { id: string; name: string; description: string | null };
type RoutineMention = { exercise_id: string; start: number; end: number; text: string };

function renderRoutineText(text: string, mentions: RoutineMention[], allowedExerciseIds: Set<string>) {
  const points = Array.from(text);
  const parts: ReactNode[] = [];
  let cursor = 0;
  [...mentions].sort((a, b) => a.start - b.start).forEach((mention, index) => {
    if (!allowedExerciseIds.has(mention.exercise_id) || mention.start < cursor || mention.end > points.length || points.slice(mention.start, mention.end).join("") !== mention.text) return;
    if (mention.start > cursor) parts.push(points.slice(cursor, mention.start).join(""));
    parts.push(<span className="my-routine-mention" key={index}>{mention.text}</span>);
    cursor = mention.end;
  });
  if (cursor < points.length) parts.push(points.slice(cursor).join(""));
  return parts;
}

type AssignedExercise = {
  id: string;
  name: string;
  description: string | null;
  has_video: boolean;
};

export default async function MyRoutine() {
  if (!productConfig()) {
    return <main className="shell"><h1>Acceso no disponible</h1></main>;
  }

  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    return (
      <main className="shell">
        <h1>Ingresá para continuar</h1>
        <Link href="/ingresar">Ingresar</Link>
      </main>
    );
  }

  const profile = await client
    .from("cueva_profiles")
    .select("role")
    .maybeSingle();

  if (profile.data?.role !== "alumno" || profile.error) {
    return (
      <main className="shell">
        <h1>Acceso restringido</h1>
        <Link href="/cuenta">Mi cuenta</Link>
      </main>
    );
  }

  // RLS vincula la ficha con el UUID autenticado y expone solo
  // la última publicación. No se utiliza service role.
  const result = await client
    .from("cueva_routine_publications")
    .select("id,content,plan,published_at")
    .order("draft_revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const publication = result.data;
  const plan = publication?.plan as Plan | null | undefined;

  // Ambas consultas están limitadas al alumno autenticado.
  // Si falla una, la otra funcionalidad continúa disponible.
  const [videos, assigned, textDocument, mentioned] = publication
    ? await Promise.all([
        client.rpc("cueva_my_routine_video_ids"),
        client.rpc("cueva_student_assigned_exercises"),
        client.from("cueva_routine_text_publications")
          .select("format,text_content,mentions,block_content").eq("publication_id", publication.id).maybeSingle(),
        client.rpc("cueva_student_mentioned_exercises"),
      ])
    : [null, null, null, null];

  const videoIds: string[] =
    !videos?.error && Array.isArray(videos?.data)
      ? videos.data
      : [];

  const assignedExercises: AssignedExercise[] =
    !assigned?.error && Array.isArray(assigned?.data)
      ? assigned.data
      : [];

  const mentionedExercises: MentionedExercise[] = textDocument?.data?.format === "text" && !mentioned?.error && Array.isArray(mentioned?.data) ? mentioned.data : [];
  const textMode = textDocument?.data?.format === "text";
  const describedExercises = textMode ? [] : assignedExercises.filter(
    exercise => exercise.description?.trim()
  );

  return (
    <StudentShell active="rutina">
      <div className="my-routine">
        <StudentPageHeading title="Mi rutina">
          {publication && (
            <p>
              Publicada el{" "}
              <time dateTime={publication.published_at}>
                {new Date(publication.published_at).toLocaleDateString(
                  "es-AR",
                  { timeZone: "America/Argentina/Buenos_Aires" }
                )}
              </time>
            </p>
          )}
        </StudentPageHeading>

        {result.error || (publication && (textDocument?.error || !textDocument?.data)) ? (
          <section className="my-routine-panel">
            <h2>No pudimos cargar tu rutina</h2>
            <p>Intentá nuevamente en unos instantes.</p>
            <Link href="/mi-rutina">Reintentar</Link>
          </section>
        ) : publication ? (
          <>
            {videos?.error && (
              <p className="student-note" role="status">
                No pudimos consultar los videos. Podés seguir tu rutina o{" "}
                <Link href="/mi-rutina">reintentar</Link>.
              </p>
            )}

            {!textMode && plan && (
              <StudentPlan
                key={publication.published_at}
                plan={plan}
                videoIds={videoIds}
              />
            )}

            {textMode && textDocument?.data?.text_content && (
              <section className="my-routine-panel my-routine-notes">
                <h2>Rutina</h2>
                <p>{renderRoutineText(textDocument.data.text_content, (textDocument.data.mentions ?? []) as RoutineMention[], new Set(mentionedExercises.map(exercise => exercise.id)))}</p>
              </section>
            )}
            {!textMode && publication.content && (
              <section className="my-routine-panel my-routine-notes">
                <h2>Observaciones</h2>
                <p>{publication.content}</p>
              </section>
            )}

            {mentionedExercises.length > 0 && (
              <section className="my-routine-panel" aria-labelledby="mentioned-exercises-title">
                <h2 id="mentioned-exercises-title">Ejercicios mencionados</h2>
                <ul>
                  {mentionedExercises.map(exercise => (
                    <li key={exercise.id}>
                      <strong>{exercise.name}</strong>
                      {exercise.description && <p>{exercise.description}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {assigned?.error && (
              <p className="student-note" role="status">
                No pudimos cargar las descripciones complementarias.
                Tu rutina sigue disponible.
              </p>
            )}

            {describedExercises.length > 0 && (
              <section className="my-routine-panel" aria-labelledby="exercise-descriptions-title">
                <h2 id="exercise-descriptions-title">
                  Descripciones de ejercicios
                </h2>
                <ul>
                  {describedExercises.map(exercise => (
                    <li key={exercise.id}>
                      <strong>{exercise.name}</strong>
                      <p>{exercise.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(textMode ? !textDocument?.data?.text_content : !plan && !publication.content) && describedExercises.length === 0 && mentionedExercises.length === 0 && (
              <p>La publicación todavía no tiene ejercicios ni observaciones.</p>
            )}
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
