"use client";

import { useEffect, useRef, useState } from "react";
import type { RoutineMention } from "@/lib/routines/mentions";
import { utf16OffsetToCodePoint } from "@/lib/routines/mentions";
import type { Exercise } from "@/lib/routines/types";

type SearchRange = { start: number; end: number; query: string } | null;

function searchRange(value: string, cursor: number): SearchRange {
  const before = value.slice(0, cursor);
  const at = before.match(/(?:^|\\s)@([^@\\n]*)$/);
  if (at) return { start: cursor - at[1].length - 1, end: cursor, query: at[1].trim() };
  const prefix = before.match(/(?:^|\\s)([^\\s@]+)$/);
  if (prefix && prefix[1].length >= 2) return { start: cursor - prefix[1].length, end: cursor, query: prefix[1] };
  return null;
}

function rebaseMentions(previous: string, next: string, mentions: RoutineMention[]) {
  const oldPoints = Array.from(previous), newPoints = Array.from(next);
  let prefix = 0;
  while (prefix < oldPoints.length && prefix < newPoints.length && oldPoints[prefix] === newPoints[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldPoints.length - prefix && suffix < newPoints.length - prefix &&
    oldPoints[oldPoints.length - 1 - suffix] === newPoints[newPoints.length - 1 - suffix]) suffix++;
  const oldEnd = oldPoints.length - suffix, newEnd = newPoints.length - suffix, delta = newEnd - oldEnd;
  return mentions.flatMap(mention => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= oldEnd) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
    return [];
  });
}

export function TextRoutineEditor({ value, mentions, disabled, onChange }: {
  value: string; mentions: RoutineMention[]; disabled: boolean;
  onChange: (value: string, mentions: RoutineMention[]) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null), request = useRef(0);
  const [range, setRange] = useState<SearchRange>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!range) { setResults([]); setPending(false); setError(""); return; }
    const sequence = ++request.current;
    const timer = window.setTimeout(async () => {
      setPending(true); setError("");
      try {
        const params = new URLSearchParams({ q: range.query, active: "1" });
        const response = await fetch("/api/ejercicios?" + params, { cache: "no-store", signal: AbortSignal.timeout(12000) });
        const data = await response.json();
        if (sequence !== request.current) return;
        if (!response.ok) { setError(data.message || "No pudimos buscar ejercicios."); setResults([]); return; }
        setResults(data.exercises ?? []); setActive(0);
      } catch {
        if (sequence === request.current) setError("No pudimos buscar ejercicios. Podés reintentar.");
      } finally {
        if (sequence === request.current) setPending(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); request.current++; };
  }, [range]);

  function handleChange(next: string, cursor: number) {
    onChange(next, rebaseMentions(value, next, mentions));
    setRange(searchRange(next, cursor));
  }

  function insert(exercise: Exercise) {
    const input = textarea.current;
    if (!input || !range || disabled) return;
    const next = value.slice(0, range.start) + exercise.name + value.slice(range.end);
    const start = utf16OffsetToCodePoint(next, range.start);
    const endUtf16 = range.start + exercise.name.length;
    const end = utf16OffsetToCodePoint(next, endUtf16);
    const nextMentions = rebaseMentions(value, next, mentions).filter(m => !(m.start < end && m.end > start));
    nextMentions.push({ exercise_id: exercise.id, start, end, text: exercise.name });
    nextMentions.sort((a, b) => a.start - b.start);
    onChange(next, nextMentions); setRange(null);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(endUtf16, endUtf16); });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!range || (!results.length && !pending)) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && results[active]) { event.preventDefault(); insert(results[active]); }
    else if (event.key === "Escape") setRange(null);
  }

  return <div className="routine-text-editor">
    <label htmlFor="routine-free-text">Rutina en texto libre</label>
    <textarea ref={textarea} id="routine-free-text" rows={16} maxLength={40000} value={value} disabled={disabled}
      aria-autocomplete="list" aria-controls="routine-mention-options"
      aria-expanded={!!range && (pending || !!results.length || !!error)}
      onChange={event => handleChange(event.target.value, event.target.selectionStart)}
      onClick={event => setRange(searchRange(value, event.currentTarget.selectionStart))}
      onKeyUp={event => {
        if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
        setRange(searchRange(value, event.currentTarget.selectionStart));
      }}
      onKeyDown={onKeyDown}
      placeholder={"Escribí la rutina completa…\\n\\nPodés mencionar ejercicios con @ o escribir su nombre."} />
    {range && (pending || error || results.length > 0) && <div className="routine-mention-suggestions" role="listbox" id="routine-mention-options" aria-label="Ejercicios sugeridos">
      {pending && <p role="status">Buscando ejercicios…</p>}
      {error && <p role="alert">{error}</p>}
      {!pending && !error && results.length === 0 && <p>No encontramos ejercicios activos con ese nombre.</p>}
      {results.map((exercise, index) => <button type="button" role="option" aria-selected={active === index} key={exercise.id}
        onMouseDown={event => event.preventDefault()} onClick={() => insert(exercise)}>{exercise.name}</button>)}
    </div>}
    <p>Las menciones quedan vinculadas al ejercicio aunque cambie su nombre. Solo se sugieren ejercicios activos.</p>
    <p className="routine-text-mention-count">{mentions.length} {mentions.length === 1 ? "mención vinculada" : "menciones vinculadas"}</p>
  </div>;
}
