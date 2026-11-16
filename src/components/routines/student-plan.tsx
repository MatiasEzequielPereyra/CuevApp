"use client";

import { useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { LegacyTarget, Plan, Target } from "@/lib/routines/types";

type VideoSource = { kind: "storage"; src: string } | { kind: "youtube"; id: string; url: string };
type Playback = { state: "loading" } | { state: "ready"; source: VideoSource } | { state: "error"; message: string; url?: string };

function ExerciseDetails({ exercise, description }: { exercise: Target | LegacyTarget; description: string | undefined }) {
  return (
    <span className="my-routine-exercise-detail">
      <strong>{exercise.name}</strong>
      <span className="my-routine-targets">
        {"sets" in exercise && <span>{exercise.sets} {exercise.sets === 1 ? "serie" : "series"}</span>}
        {"reps" in exercise
          ? <><span>{exercise.reps} {exercise.reps === "1" ? "repetición" : "repeticiones"}</span><span>{exercise.weight_kg === null ? "Peso sin definir" : `${exercise.weight_kg} kg`}</span></>
          : <span>{exercise.duration} {exercise.unit === "seconds" ? (exercise.duration === 1 ? "segundo" : "segundos") : (exercise.duration === 1 ? "minuto" : "minutos")}</span>}
      </span>
      {exercise.note && <span className="my-routine-exercise-note">{exercise.note}</span>}
      {description && <span className="my-routine-exercise-note">{description}</span>}
    </span>
  );
}

function VideoIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 3.5v13l10-6.5Z" /></svg>;
}

export function StudentPlan({ plan, videoIds, exerciseDescriptions = {} }: { plan: Plan; videoIds: string[]; exerciseDescriptions?: Record<string, string> }) {
  const [selected, setSelected] = useState("");
  const [playing, setPlaying] = useState<{ name: string; id: string } | null>(null);
  const [playback, setPlayback] = useState<Playback>({ state: "loading" });
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogTitle = useId();
  const dayContent = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController>(null);
  const position = useRef({ x: 0, y: 0 });
  const days = plan.version === 2 ? plan.days : [];
  const day = days.find(value => value.id === selected) ?? days[0];
  const blocks = plan.version === 1 ? plan.blocks : day?.blocks ?? [];
  const videos = new Set(videoIds);

  async function loadVideo(id: string) {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setPlayback({ state: "loading" });
    try {
      const response = await fetch(`/api/ejercicios/video?id=${encodeURIComponent(id)}&player=1`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), cache: "no-store",
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setPlayback({ state: "error", message: data.message || "No pudimos cargar el video." });
        return;
      }
      setPlayback({ state: "ready", source: data as VideoSource });
    } catch {
      if (!controller.signal.aborted) setPlayback({ state: "error", message: "No pudimos cargar el video. Intentá nuevamente." });
    }
  }

  function openVideo(event: MouseEvent<HTMLButtonElement>, exercise: Target | LegacyTarget) {
    trigger.current = event.currentTarget;
    position.current = { x: window.scrollX, y: window.scrollY };
    setPlaying({ id: exercise.exercise_id, name: exercise.name });
    dialog.current?.showModal();
    void loadVideo(exercise.exercise_id);
  }

  function restoreReadingPosition() {
    request.current?.abort();
    setPlaying(null);
    setPlayback({ state: "loading" });
    trigger.current?.focus({ preventScroll: true });
    window.scrollTo({ left: position.current.x, top: position.current.y, behavior: "instant" });
  }

  const youtube = playback.state === "ready" && playback.source.kind === "youtube" ? playback.source : null;
  let media: ReactNode;
  if (playback.state === "loading") media = <p role="status">Cargando video…</p>;
  else if (playback.state === "error") media = (
    <>
      <p role="alert">{playback.message}</p>
      {playing && <button type="button" onClick={() => void loadVideo(playing.id)}>Reintentar</button>}
      {playback.url && <a href={playback.url} target="_blank" rel="noopener noreferrer">Abrir en YouTube</a>}
    </>
  );
  else if (playback.source.kind === "storage") media = (
    <video controls autoPlay playsInline preload="metadata" aria-label={playing?.name} src={playback.source.src}
      onError={() => setPlayback({ state: "error", message: "No pudimos reproducir el video." })} />
  );
  else if (youtube) media = (
    <>
      <iframe title={`Video de ${playing?.name}`} src={`https://www.youtube-nocookie.com/embed/${youtube.id}?autoplay=1&playsinline=1`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onError={() => setPlayback({ state: "error", message: "No pudimos cargar el reproductor de YouTube.", url: youtube.url })} />
      <a href={youtube.url} target="_blank" rel="noopener noreferrer">Abrir en YouTube</a>
    </>
  );

  return (
    <>
      {days.length > 0 && (
        <div className="my-routine-days" role="group" aria-label="Día de entrenamiento">
          {days.map(item => (
            <button key={item.id} type="button" aria-controls={dayContent} aria-pressed={item.id === day?.id}
              onClick={() => setSelected(item.id)}>{item.name}</button>
          ))}
        </div>
      )}
      <div className="my-routine-blocks" id={dayContent}>
        {plan.version === 1 && <p className="my-routine-muted">Planificación anterior. Las series figuran en cada ejercicio.</p>}
        {day && <h2>{day.name}</h2>}
        {!blocks.length && <p className="my-routine-muted">{day ? "Este día todavía no tiene bloques." : "Esta rutina todavía no tiene bloques."}</p>}
        {blocks.map((block, index) => (
          <section className="my-routine-block" key={block.id}>
            <header>
              {day ? <h3>{block.name || `Bloque ${index + 1}`}</h3> : <h2>{block.name || `Bloque ${index + 1}`}</h2>}
              {"rounds" in block && <span>{block.rounds} {block.rounds === 1 ? "vuelta" : "vueltas"}</span>}
            </header>
            {block.exercises.length > 0 ? (
              <ol role="list">
                {block.exercises.map((exercise, exerciseIndex) => (
                  <li key={exercise.id}>
                    {videos.has(exercise.exercise_id) ? (
                      <button type="button" className="my-routine-exercise" aria-haspopup="dialog" onClick={event => openVideo(event, exercise)}>
                        <span className="my-routine-exercise-order" aria-hidden="true">{exerciseIndex + 1}</span>
                        <ExerciseDetails exercise={exercise} description={exerciseDescriptions[exercise.exercise_id]} />
                        <span className="my-routine-video-label"><VideoIcon /> Video</span>
                      </button>
                    ) : (
                      <div className="my-routine-exercise">
                        <span className="my-routine-exercise-order" aria-hidden="true">{exerciseIndex + 1}</span>
                        <ExerciseDetails exercise={exercise} description={exerciseDescriptions[exercise.exercise_id]} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : <p className="my-routine-empty-block">Bloque sin ejercicios.</p>}
          </section>
        ))}
      </div>
      <dialog ref={dialog} className="my-routine-dialog" aria-labelledby={dialogTitle} onClose={restoreReadingPosition}>
        <header>
          <h2 id={dialogTitle}>{playing?.name ?? "Video del ejercicio"}</h2>
          <form method="dialog"><button type="submit">Cerrar</button></form>
        </header>
        {playing && media}
      </dialog>
    </>
  );
}
