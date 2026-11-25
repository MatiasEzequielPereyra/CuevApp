"use client";

import { createPortal } from "react-dom";
import { ExerciseVideoDialog } from "@/components/routines/exercise-video-dialog";
import { StudentWorkoutLogger } from "@/components/routines/student-workout-logger";
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
};

type FloatingPosition = { left: number; top: number; width: number };

export function ExerciseMention({ exerciseId, name, description, videoAvailability, text, publicationId, trackingMode, targetId, hue = 250, showWorkoutLogger = true }: ExerciseMentionProps) {
  const [open, setOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const instanceId = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = `${instanceId}-exercise-mention`;

  const positionPanel = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom;
    const maxHeight = Math.min(260, window.innerHeight - 16);
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
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node
        && !root.current?.contains(event.target)
        && !panel.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
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
  }, [open, positionPanel]);

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
      {showWorkoutLogger && <StudentWorkoutLogger publicationId={publicationId} exerciseId={exerciseId} exerciseName={name} trackingMode={trackingMode} {...(targetId ? { targetId } : {})} />}
      {open && position && typeof document !== "undefined" && createPortal(
        <div ref={panel} id={panelId} className="my-routine-mention-preview" role="dialog"
          tabIndex={-1} aria-label={`Ejercicio: ${name}`}
          style={{ position: "fixed", left: position.left, top: position.top, width: position.width,
            maxHeight: "min(260px, calc(100dvh - 16px))", overflow: "auto", zIndex: 10000 }}>
          <strong>{name}</strong>
          {description && <span>{description}</span>}
          {videoAvailability === "available"
            ? <button type="button" className="my-routine-mention-play" onClick={() => {
              // Preserve the exercise trigger as the dialog's native return-focus target.
              trigger.current?.focus({ preventScroll: true });
              setOpen(false);
              setPlayerOpen(true);
            }}>Ver video</button>
            : videoAvailability === "unavailable"
              ? <span role="status">Aún no se encuentra con video disponible</span>
              : <span role="status">No pudimos comprobar si hay un video disponible.</span>}
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
