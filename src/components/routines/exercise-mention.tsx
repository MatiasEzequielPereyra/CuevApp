"use client";

import { createPortal } from "react-dom";
import { ExerciseVideoDialog } from "@/components/routines/exercise-video-dialog";
import { StudentWorkoutLogger } from "@/components/routines/student-workout-logger";
import { StudentWorkoutRowLogger } from "@/components/routines/student-workout-row-logger";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";

type ExerciseMentionProps = {
  exerciseId: string;
  name: string;
  description: string | null;
  videoAvailability: "available" | "unavailable" | "unknown";
  text: string;
  publicationId: string;
  trackingMode: "weight" | "time";
  targetId?: string;
  hue?: number;
  showWorkoutLogger?: boolean;
  studentId?: string;
  availableExercises?: { id: string; name: string; tracking_mode: "weight" | "time" }[];
  videoKind?: "youtube" | "file" | null;
};

type FloatingPosition = { left: number; top: number; width: number };

export function ExerciseMention({ exerciseId, name, description, videoAvailability, text, publicationId, trackingMode, targetId, hue = 250, showWorkoutLogger = true, studentId, availableExercises = [], videoKind }: ExerciseMentionProps) {
  const [open, setOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resolvedVideoAvailability, setResolvedVideoAvailability] = useState(videoAvailability);
  const [resolvedVideoKind, setResolvedVideoKind] = useState(videoKind ?? null);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const instanceId = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = `${instanceId}-exercise-mention`;

  const positionPanel = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(420, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom;
    const maxHeight = Math.min(720, window.innerHeight - 16);
    const top = below >= maxHeight + 8 || rect.top < maxHeight
      ? Math.min(rect.bottom + 8, window.innerHeight - maxHeight - 8)
      : Math.max(8, rect.top - maxHeight - 8);
    setPosition({ left, top, width });
  }, []);

  function showPreview() {
    positionPanel();
    setOpen(true);
  }

  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (videoAvailability !== "unknown") {
      setResolvedVideoAvailability(videoAvailability);
      setResolvedVideoKind(videoKind ?? null);
      return;
    }
    const controller = new AbortController();
    setCheckingVideo(true);
    void fetch(`/api/ejercicios/video?id=${encodeURIComponent(exerciseId)}&check=1`, {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (response.ok) {
        setResolvedVideoAvailability("available");
        setResolvedVideoKind(data.kind === "youtube" || data.kind === "file" ? data.kind : null);
      } else if (response.status === 404) {
        setResolvedVideoAvailability("unavailable");
        setResolvedVideoKind(null);
      } else {
        setResolvedVideoAvailability("unknown");
      }
    }).catch(() => {
      if (!controller.signal.aborted) setResolvedVideoAvailability("unknown");
    }).finally(() => {
      if (!controller.signal.aborted) setCheckingVideo(false);
    });
    return () => controller.abort();
  }, [open, exerciseId, videoAvailability, videoKind]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (playerOpen && event.target instanceof Element && event.target.closest("dialog")) return;
      if (event.target instanceof Node
        && !root.current?.contains(event.target)
        && !panel.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (playerOpen) return;
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", positionPanel, true);
    window.addEventListener("resize", positionPanel);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", positionPanel, true);
      window.removeEventListener("resize", positionPanel);
    };
  }, [open, playerOpen, positionPanel]);

  return (
    <div
      className="my-routine-mention-wrap"
      ref={root}
      data-exercise-id={exerciseId}
      onBlur={event => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || (!root.current?.contains(next) && !panel.current?.contains(next))) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="my-routine-mention"
        style={{ "--mention-hue": hue } as CSSProperties}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={showPreview}
      >
        {text}
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div ref={panel} id={panelId} className="my-routine-mention-preview" role="dialog"
          tabIndex={-1} aria-label={`Ejercicio: ${name}`}
          style={{ position: "fixed", left: position.left, top: position.top, width: position.width,
            maxHeight: "min(720px, calc(100dvh - 16px))", overflow: "auto", zIndex: 10000 }}>
          <header className="my-routine-mention-heading">
            <strong>{name}</strong>
            {resolvedVideoAvailability === "available"
              ? <button type="button" className={`my-routine-mention-play${resolvedVideoKind === "youtube" ? " my-routine-mention-play-youtube" : ""}`} onClick={() => {
                // Keep the workout form mounted while the video dialog is shown.
                trigger.current?.focus({ preventScroll: true });
                setPlayerOpen(true);
              }}><span aria-hidden="true">▶</span> Ver video</button>
              : resolvedVideoAvailability === "unavailable"
                ? <span role="status">No se cuenta con video disponible.</span>
                : <span role="status">{checkingVideo ? "Comprobando video…" : "No pudimos comprobar si hay un video disponible."}</span>}
          </header>
          {description && <span>{description}</span>}
          {showWorkoutLogger && (availableExercises.length > 1
            ? <StudentWorkoutRowLogger exercises={availableExercises} publicationId={publicationId} embedded {...(studentId ? { studentId } : {})} />
            : <StudentWorkoutLogger publicationId={publicationId} exerciseId={exerciseId} exerciseName={name} trackingMode={trackingMode} embedded {...(targetId ? { targetId } : {})} {...(studentId ? { studentId } : {})} />)}
        </div>,
        document.body
      )}
      {playerOpen && <ExerciseVideoDialog exerciseId={exerciseId} exerciseName={name} open onClose={() => {
        setPlayerOpen(false);
        const active = document.activeElement;
        // Restore focus only when the closing dialog still owns it; do not steal
        // focus if the user has already moved elsewhere during the close event.
        if (active === document.body || active === trigger.current
          || (active instanceof HTMLElement && active.closest("dialog"))) {
          trigger.current?.focus({ preventScroll: true });
        }
      }} />}
    </div>
  );
}
