"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type ExerciseMentionProps = {
  exerciseId: string;
  name: string;
  description: string | null;
  hasVideo: boolean;
  text: string;
};

export function ExerciseMention({ exerciseId, name, description, hasVideo, text }: ExerciseMentionProps) {
  const [open, setOpen] = useState(false);
  const instanceId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = `${instanceId}-exercise-mention`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      className="my-routine-mention-wrap"
      ref={root}
      data-exercise-id={exerciseId}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={event => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onBlur={event => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="my-routine-mention"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        {text}
      </button>
      {open && (
        <span id={panelId} className="my-routine-mention-preview" role="dialog" aria-label={`Ejercicio: ${name}`}>
          <strong>{name}</strong>
          {description && <span>{description}</span>}
          {hasVideo ? <Link href="/ejercicios">Abrir catálogo de ejercicios</Link> : <span role="status">Aún no se encuentra con video disponible</span>}
        </span>
      )}
    </span>
  );
}
