"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { RoutineMention } from "@/lib/routines/mentions";
import { rebaseRoutineMentions, utf16OffsetToCodePoint } from "@/lib/routines/mentions";
import type { Exercise } from "@/lib/routines/types";

type SearchRange = { start: number; end: number; query: string } | null;

function renderMentionHighlights(value: string, mentions: RoutineMention[]): ReactNode[] {
  const points = Array.from(value);
  const parts: ReactNode[] = [];
  let cursor = 0;
  [...mentions].sort((a, b) => a.start - b.start).forEach((mention, index) => {
    if (mention.start < cursor || mention.start < 0 || mention.end > points.length
      || points.slice(mention.start, mention.end).join("") !== mention.text) return;
    if (mention.start > cursor) parts.push(points.slice(cursor, mention.start).join(""));
    parts.push(<strong className="routine-text-mention-highlight" key={`mention-${mention.exercise_id}-${mention.start}-${index}`}>{mention.text}</strong>);
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
  const atQuery = at?.[1];
  if (atQuery !== undefined) return { start: cursor - atQuery.length - 1, end: cursor, query: atQuery.trim() };
  const prefix = before.match(/(?:^|\s)([^\s@]+)$/);
  const prefixQuery = prefix?.[1];
  if (prefixQuery !== undefined && prefixQuery.length >= 2) return { start: cursor - prefixQuery.length, end: cursor, query: prefixQuery };
  return null;
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
    setRange(next);
  }

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

  function insert(exercise: Exercise) {
    const input = textarea.current;
    if (!input || !range || disabled || pending || error
      || !results.some(result => result.id === exercise.id)) return;
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
      onClick={event => updateRange(searchRange(value, event.currentTarget.selectionStart))}
      onKeyUp={event => {
        if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
        updateRange(searchRange(value, event.currentTarget.selectionStart));
      }}
      onKeyDown={onKeyDown}
      placeholder={"Escribí la rutina completa…\n\nPodés mencionar ejercicios con @ o escribir su nombre."} />
    </div>
    {range && <div className="routine-mention-suggestions" role="listbox" id="routine-mention-options" aria-label="Ejercicios sugeridos">
      {pending && <p role="status">Buscando ejercicios…</p>}
      {error && <><p role="alert">{error}</p><button type="button" disabled={disabled || pending} onClick={retrySearch}>Reintentar búsqueda</button></>}
      {!pending && !error && results.length === 0 && <p>No encontramos ejercicios activos con ese nombre.</p>}
      {results.map((exercise, index) => <button type="button" role="option" aria-selected={active === index} key={exercise.id} disabled={disabled || pending}
        onMouseDown={event => event.preventDefault()} onClick={() => insert(exercise)}>{exercise.name}</button>)}
    </div>}
    <p>Las menciones quedan vinculadas al ejercicio aunque cambie su nombre. Solo se sugieren ejercicios activos.</p>
    <p className="routine-text-mention-count">{mentions.length} {mentions.length === 1 ? "mención vinculada" : "menciones vinculadas"}</p>
  </div>;
}
