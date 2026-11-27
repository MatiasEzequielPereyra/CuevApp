import { StudentPlan } from "@/components/routines/student-plan";
import { ExerciseMention } from "@/components/routines/exercise-mention";
import { StudentWorkoutExerciseSummary } from "@/components/routines/student-workout-exercise-summary";
import { resolveMentionVideoAvailability } from "@/lib/routines/mention-video-availability";
import type { ReactNode } from "react";
import type { Plan } from "@/lib/routines/types";
import { getRoutineMentionHues } from "@/lib/routines/mentions";
import Link from "next/link";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { StudentPageHeading, StudentShell } from "@/components/routines/student-shell";

import "./mi-rutina.css";

export const dynamic = "force-dynamic";

type MentionedExercise = { id: string; name: string; description: string | null; tracking_mode: "weight" | "time"; videoAvailability: "available" | "unavailable" | "unknown" };
type RoutineMention = { exercise_id: string; start: number; end: number; text: string };

function renderRoutineText(text: string, mentions: RoutineMention[], exercisesById: Map<string, MentionedExercise>, publicationId: string) {
  const points = Array.from(text);
  const ordered = [...mentions].sort((a, b) => a.start - b.start);
  const hues = getRoutineMentionHues(ordered);
  const lines: ReactNode[] = [];
  let lineStart = 0;

  text.split("\n").forEach((line, lineIndex) => {
    const lineEnd = lineStart + Array.from(line).length;
    const lineMentions = ordered.filter(mention =>
      mention.start >= lineStart && mention.end <= lineEnd
    );
    const content: ReactNode[] = [];
    let cursor = lineStart;
    const lineExercises = lineMentions
      .map(mention => exercisesById.get(mention.exercise_id))
      .filter((exercise): exercise is MentionedExercise => !!exercise);

    lineMentions.forEach((mention, index) => {
      const exercise = exercisesById.get(mention.exercise_id);
      if (!exercise || mention.start < cursor
        || points.slice(mention.start, mention.end).join("") !== mention.text) return;
      if (mention.start > cursor) content.push(points.slice(cursor, mention.start).join(""));
      content.push(
        <span className="my-routine-exercise-with-summary" key={`${mention.exercise_id}:${mention.start}:${index}`}>
          <ExerciseMention
            exerciseId={exercise.id} name={exercise.name} description={exercise.description}
            videoAvailability={exercise.videoAvailability} text={mention.text}
            publicationId={publicationId} trackingMode={exercise.tracking_mode}
            hue={hues.get(`${mention.exercise_id}:${mention.start}:${mention.end}`) ?? 250}
            availableExercises={lineExercises.map(({ id, name, tracking_mode }) => ({ id, name, tracking_mode }))} />
          <StudentWorkoutExerciseSummary exerciseId={exercise.id} exerciseName={exercise.name} />
        </span>
      );
      cursor = mention.end;
    });

    if (cursor < lineEnd) content.push(points.slice(cursor, lineEnd).join(""));
    lines.push(
      <div className="my-routine-text-line" key={`line-${lineIndex}`}>
        <span>{content.length ? content : "\u00a0"}</span>
      </div>
    );
    lineStart = lineEnd + 1;
  });
  return lines;
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
        client.rpc("cueva_student_mentioned_exercises_with_tracking_mode"),
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

  const mentionedExercises: MentionedExercise[] = textDocument?.data?.format === "text" && !mentioned?.error && Array.isArray(mentioned?.data)
    ? mentioned.data.map(exercise => ({ ...exercise, videoAvailability: resolveMentionVideoAvailability(exercise.id, videos?.data, Boolean(videos?.error)) }))
    : [];
  const textMode = textDocument?.data?.format === "text";
  const mentionedExercisesById = new Map(mentionedExercises.map(exercise => [exercise.id, exercise]));

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

        {result.error || (publication && textDocument?.error) ? (
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
                publicationId={publication.id}
                videoIds={videoIds}
                videosAvailable={!videos?.error}
                exerciseMetadata={assignedExercises}
              />
            )}

            {textMode && textDocument?.data?.text_content && (
              <section className="my-routine-panel my-routine-notes">
                <h2>Rutina</h2>
                <div className="my-routine-text-content">{renderRoutineText(textDocument.data.text_content, (textDocument.data.mentions ?? []) as RoutineMention[], mentionedExercisesById, publication.id)}</div>
              </section>
            )}
            {!textMode && publication.content && (
              <section className="my-routine-panel my-routine-notes">
                <h2>Observaciones</h2>
                <p>{publication.content}</p>
              </section>
            )}

            {assigned?.error && (
              <p className="student-note" role="status">
                No pudimos cargar las descripciones complementarias.
                Tu rutina sigue disponible.
              </p>
            )}

            {(textMode ? !textDocument?.data?.text_content : !plan && !publication.content) && (
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
