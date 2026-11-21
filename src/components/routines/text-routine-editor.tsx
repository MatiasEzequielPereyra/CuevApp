"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { RoutineMention } from "@/lib/routines/mentions";
import { getRoutineMentionHues, rebaseRoutineMentions, utf16OffsetToCodePoint } from "@/lib/routines/mentions";
import type { Exercise } from "@/lib/routines/types";
import { ExerciseVideoDialog } from "@/components/routines/exercise-video-dialog";
import type { CSSProperties } from "react";

type SearchRange = { start: number; end: number; query: string } | null;

function renderMentionHighlights(value: string, mentions: RoutineMention[]): ReactNode[] {
  const points = Array.from(value);
  const parts: ReactNode[] = [];
  let cursor = 0;
  const orderedMentions = [...mentions].sort((a, b) => a.start - b.start);
  const hues = getRoutineMentionHues(orderedMentions);
  orderedMentions.forEach((mention, index) => {
    if (mention.start < cursor || mention.start < 0 || mention.end > points.length
      || points.slice(mention.start, mention.end).join("") !== mention.text) return;
    if (mention.start > cursor) parts.push(points.slice(cursor, mention.start).join(""));
    parts.push(<strong className="routine-text-mention-highlight" style={{ "--mention-hue": hues.get(mention.exercise_id + ":" + mention.start + ":" + mention.end) ?? 250 } as CSSProperties} key={`mention-${mention.exercise_id}-${mention.start}-${index}`}>{mention.text}</strong>);
    cursor = mention.end;
  });
  if (cursor < points.length) parts.push(points.slice(cursor).join(""));
  // Preserve a visible final line when the source ends with a newline.
  if (value.endsWith("\n")) parts.push("\u200b");
  return parts;
}

function searchRange(value: string, cursor: number): SearchRange {
  const before = value.slice(0, cursor);
  const at = before.match(/(?:^|\s)@([^@\n]*)$/);
  if (!at) return null;
  const rawQuery = at[1] ?? "";
  return { start: cursor - rawQuery.length - 1, end: cursor, query: rawQuery.trim() };
}

export function TextRoutineEditor({ value, mentions, disabled, onChange }: {
  value: string; mentions: RoutineMention[]; disabled: boolean;
  onChange: (value: string, mentions: RoutineMention[]) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null), highlight = useRef<HTMLDivElement>(null), request = useRef(0);
  const [range, setRange] = useState<SearchRange>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [suggestionPosition, setSuggestionPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!range) return;
    const sequence = ++request.current;
    const controller = new AbortController();
    let active = true;
    let timeout: number | undefined;
    const timer = window.setTimeout(async () => {
      timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const params = new URLSearchParams({ q: range.query, active: "1" });
        const response = await fetch("/api/ejercicios?" + params, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!active || sequence !== request.current) return;
        if (!response.ok) { setError(data.message || "No pudimos buscar ejercicios."); setResults([]); return; }
        setResults(data.exercises ?? []); setActive(0);
      } catch {
        if (active && sequence === request.current) setError("No pudimos buscar ejercicios. Podés reintentar.");
      } finally {
        if (timeout !== undefined) window.clearTimeout(timeout);
        if (active && sequence === request.current) setPending(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      if (timeout !== undefined) window.clearTimeout(timeout);
      active = false;
      controller.abort();
    };
  }, [range]);

  function updateRange(next: SearchRange) {
    // Invalidate immediately, before effect cleanup can observe the old request.
    request.current++;
    setResults([]);
    setActive(0);
    setPending(!!next);
    setError("");
    setCreateError("");
    setRange(next);
  }

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!range || !input || typeof document === "undefined") return;
    const measure = () => {
      const style = window.getComputedStyle(input);
      const mirror = document.createElement("div");
      const marker = document.createElement("span");
      const properties = [
        "font", "font-family", "font-size", "font-weight", "font-style",
        "letter-spacing", "line-height", "text-transform", "text-indent",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "border-top-width", "border-right-width", "border-bottom-width",
        "border-left-width", "box-sizing", "white-space", "overflow-wrap", "word-break",
      ];
      mirror.style.position = "fixed";
      mirror.style.visibility = "hidden";
      mirror.style.pointerEvents = "none";
      mirror.style.left = input.getBoundingClientRect().left - input.scrollLeft + "px";
      mirror.style.top = input.getBoundingClientRect().top - input.scrollTop + "px";
      mirror.style.width = input.clientWidth + "px";
      mirror.style.height = "auto";
      mirror.style.overflow = "hidden";
      for (const property of properties) mirror.style.setProperty(property, style.getPropertyValue(property));
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.overflowWrap = "break-word";
      mirror.textContent = input.value.slice(0, input.selectionStart);
      marker.textContent = "\u200b";
      mirror.append(marker);
      document.body.append(mirror);
      const caret = marker.getBoundingClientRect();
      mirror.remove();
      const width = Math.min(360, window.innerWidth - 16);
      const left = Math.max(8, Math.min(caret.left, window.innerWidth - width - 8));
      const below = window.innerHeight - caret.bottom;
      const top = below >= 250 || caret.top < 250
        ? Math.min(caret.bottom + 4, window.innerHeight - 248)
        : Math.max(8, caret.top - 244);
      setSuggestionPosition({ left, top, width });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [range, value]);

  function retrySearch() {
    if (!range || disabled) return;
    request.current++;
    setResults([]);
    setActive(0);
    setPending(true);
    setError("");
    setRange({ ...range });
  }

  function handleChange(next: string, cursor: number) {
    onChange(next, rebaseRoutineMentions(value, next, mentions));
    updateRange(searchRange(next, cursor));
  }

  function insert(exercise: Exercise, allowUnlisted = false) {
    const input = textarea.current;
    if (!input || !range || disabled || pending || error
      || (!allowUnlisted && !results.some(result => result.id === exercise.id))) return;
    const next = value.slice(0, range.start) + exercise.name + value.slice(range.end);
    const start = utf16OffsetToCodePoint(next, range.start);
    const endUtf16 = range.start + exercise.name.length;
    const end = utf16OffsetToCodePoint(next, endUtf16);
    const nextMentions = rebaseRoutineMentions(value, next, mentions).filter(m => !(m.start < end && m.end > start));
    nextMentions.push({ exercise_id: exercise.id, start, end, text: exercise.name });
    nextMentions.sort((a, b) => a.start - b.start);
    onChange(next, nextMentions); updateRange(null);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(endUtf16, endUtf16); });
  }

  async function createExerciseFromMention() {
    if (!range || disabled || pending || creatingExercise || !range.query.trim()) return;
    const name = range.query.trim().slice(0, 120);
    setCreatingExercise(true);
    setCreateError("");
    try {
      const response = await fetch("/api/ejercicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: crypto.randomUUID(), name, active: true, revision: 0,
          description: "", video_url: null, video_path: null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.exercise) {
        if (response.status === 409) {
          setCreateError(data.message || "Ya existe un ejercicio similar. Volvé a buscarlo en el catálogo.");
          return;
        }
        throw new Error(data.message || "No se pudo crear el ejercicio.");
      }
      insert(data.exercise as Exercise, true);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "No se pudo crear el ejercicio.");
    } finally {
      setCreatingExercise(false);
    }
  }

  async function openMentionAtCursor(input: HTMLTextAreaElement) {
    if (input.selectionStart !== input.selectionEnd) return;
    const cursor = utf16OffsetToCodePoint(value, input.selectionStart);
    const mention = mentions.find(item => cursor >= item.start && cursor <= item.end);
    if (!mention) { setPreview(null); return; }
    setPreview(null); setPreviewError(""); setPreviewPending(true);
    try {
      const params = new URLSearchParams({ q: mention.text });
      const response = await fetch("/api/ejercicios?" + params, { cache: "no-store" });
      const data = await response.json();
      const exercise = Array.isArray(data.exercises) ? data.exercises.find((item: Exercise) => item.id === mention.exercise_id) : null;
      if (!response.ok || !exercise) throw new Error(data.message || "No pudimos cargar los datos del ejercicio.");
      setPreview(exercise);
    } catch (cause) { setPreviewError(cause instanceof Error ? cause.message : "No pudimos cargar los datos del ejercicio."); }
    finally { setPreviewPending(false); }
  }
  function syncHighlightScroll() {
    if (textarea.current && highlight.current) {
      highlight.current.scrollTop = textarea.current.scrollTop;
      highlight.current.scrollLeft = textarea.current.scrollLeft;
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!range) return;
    if (event.key === "Escape") { updateRange(null); return; }
    if (pending || error || !results.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && results[active]) { event.preventDefault(); insert(results[active]); }
  }

  return <div className="routine-text-editor">
    <label htmlFor="routine-free-text">Rutina en texto libre</label>
    <div className="routine-text-input">
      <div ref={highlight} className="routine-text-highlight-layer" aria-hidden="true">
        {renderMentionHighlights(value, mentions)}
      </div>
      <textarea ref={textarea} id="routine-free-text" rows={16} maxLength={40000} value={value} disabled={disabled}
      aria-autocomplete="list" aria-controls="routine-mention-options"
      onScroll={syncHighlightScroll}
      onChange={event => handleChange(event.target.value, event.target.selectionStart)}
      onClick={event => { updateRange(null); void openMentionAtCursor(event.currentTarget); }}
      onKeyDown={onKeyDown}
      placeholder={"Escribí la rutina completa…\n\nPodés mencionar ejercicios con @ o escribir su nombre."} />
      {previewPending && <div className="routine-text-mention-preview" role="status">Cargando ejercicio…</div>}
      {previewError && <div className="routine-text-mention-preview" role="alert">{previewError}</div>}
      {preview && !playerOpen && <div className="routine-text-mention-preview" role="dialog" aria-label={"Ejercicio: " + preview.name}>
        <strong>{preview.name}</strong>
        {preview.description && <p>{preview.description}</p>}
        {preview.video_url || preview.video_path
          ? <button type="button" onClick={() => { updateRange(null); setPlayerOpen(true); }}>Ver video</button>
          : <span role="status">Aún no se encuentra con video disponible</span>}
        <button type="button" className="routine-text-mention-close" onClick={() => setPreview(null)}>Cerrar</button>
      </div>}
    </div>
    {playerOpen && preview && <ExerciseVideoDialog exerciseId={preview.id} exerciseName={preview.name} open onClose={() => { setPlayerOpen(false); setPreview(null); }} /> }
    {range && suggestionPosition && typeof document !== "undefined" && createPortal(<div className="routine-mention-suggestions" role="listbox" id="routine-mention-options" aria-label="Ejercicios sugeridos" style={{ position: "fixed", left: suggestionPosition.left, top: suggestionPosition.top, width: suggestionPosition.width, maxHeight: "min(240px, calc(100dvh - 16px))", zIndex: 1000 }}>
      {pending && <p role="status">Buscando ejercicios…</p>}
      {createError && <p role="alert">{createError}</p>}
      {!pending && !error && results.length === 0 && range.query.trim() && <button type="button" disabled={disabled || creatingExercise} onMouseDown={event => event.preventDefault()} onClick={() => void createExerciseFromMention()}>{creatingExercise ? "Creando ejercicio…" : `Crear “${range.query.trim()}” en Ejercicios`}</button>}
      {error && <><p role="alert">{error}</p><button type="button" disabled={disabled || pending} onClick={retrySearch}>Reintentar búsqueda</button></>}
      {!pending && !error && results.length === 0 && <p>No encontramos ejercicios activos con ese nombre.</p>}
      {results.map((exercise, index) => <button type="button" role="option" aria-selected={active === index} key={exercise.id} disabled={disabled || pending}
        onMouseDown={event => event.preventDefault()} onClick={() => insert(exercise)}>{exercise.name}</button>)}
    </div>, document.body)}
    <p>Las menciones quedan vinculadas al ejercicio aunque cambie su nombre. Solo se sugieren ejercicios activos.</p>
    <p className="routine-text-mention-count">{mentions.length} {mentions.length === 1 ? "mención vinculada" : "menciones vinculadas"}</p>
  </div>;
}
