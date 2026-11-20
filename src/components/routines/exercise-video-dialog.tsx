"use client";

import { useEffect, useId, useRef, useState } from "react";

type VideoSource = { kind: "storage"; src: string } | { kind: "youtube"; id: string; url: string };
type Playback = { state: "loading" } | { state: "ready"; source: VideoSource } | { state: "error"; message: string; url?: string };

function isVideoSource(value: unknown): value is VideoSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  if (source.kind === "storage") return typeof source.src === "string" && source.src.startsWith("https://");
  return source.kind === "youtube"
    && typeof source.id === "string"
    && /^[A-Za-z0-9_-]{11}$/.test(source.id)
    && typeof source.url === "string"
    && /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}$/.test(source.url);
}

export function ExerciseVideoDialog({ exerciseId, exerciseName, open, onClose }: {
  exerciseId: string;
  exerciseName: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const titleId = useId();
  const [playback, setPlayback] = useState<Playback>({ state: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    void (async () => {
      try {
        const response = await fetch(`/api/ejercicios/video?id=${encodeURIComponent(exerciseId)}&player=1`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
          cache: "no-store",
        });
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message : "No pudimos cargar el video.";
          setPlayback({ state: "error", message });
          return;
        }
        if (!isVideoSource(data)) {
          setPlayback({ state: "error", message: "El recurso de video no tiene un formato válido." });
          return;
        }
        setPlayback({ state: "ready", source: data });
      } catch {
        if (!controller.signal.aborted) setPlayback({ state: "error", message: "No pudimos cargar el video. Intentá nuevamente." });
      }
    })();
    return () => {
      controller.abort();
      request.current = null;
    };
  }, [exerciseId, open, retry]);

  function retryPlayback() {
    setPlayback({ state: "loading" });
    setRetry(value => value + 1);
  }

  function close() {
    request.current?.abort();
    onClose();
  }

  const media = playback.state === "loading"
    ? <p role="status">Cargando video…</p>
    : playback.state === "error"
      ? <><p role="alert">{playback.message}</p><button type="button" onClick={retryPlayback}>Reintentar</button>{playback.url && <a href={playback.url} target="_blank" rel="noopener noreferrer">Abrir en YouTube</a>}</>
      : playback.source.kind === "storage"
        ? <video controls autoPlay playsInline preload="metadata" aria-label={exerciseName} src={playback.source.src}
            onError={() => setPlayback({ state: "error", message: "No pudimos reproducir el video." })} />
        : <><iframe title={`Video de ${exerciseName}`} src={`https://www.youtube-nocookie.com/embed/${playback.source.id}?autoplay=1&playsinline=1`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setPlayback({ state: "error", message: "No pudimos cargar el reproductor de YouTube.", url: playback.source.url })} />
          <a href={playback.source.url} target="_blank" rel="noopener noreferrer">Abrir en YouTube</a></>;

  return (
    <dialog ref={dialog} className="my-routine-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (open) close(); }}>
      <header>
        <h2 id={titleId}>{exerciseName}</h2>
        <button type="button" onClick={close}>Cerrar</button>
      </header>
      {open && media}
    </dialog>
  );
}
