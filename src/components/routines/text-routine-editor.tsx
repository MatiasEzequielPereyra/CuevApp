"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCallback } from "react";
import type { RoutineMention } from "@/lib/routines/mentions";
import { codePointSlice, getRoutineMentionHues, rebaseRoutineMentions, utf16OffsetToCodePoint, validateRoutineMentions } from "@/lib/routines/mentions";
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

function measureCaretRect(input: HTMLTextAreaElement): DOMRect {
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
  return caret;
}

function floatingPosition(caret: DOMRect, preferredWidth: number) {
  const width = Math.min(preferredWidth, window.innerWidth - 16);
  const left = Math.max(8, Math.min(caret.left, window.innerWidth - width - 8));
  const below = window.innerHeight - caret.bottom;
  const maxHeight = 240;
  const top = below >= maxHeight + 8 || caret.top < maxHeight
    ? Math.min(caret.bottom + 4, window.innerHeight - maxHeight - 8)
    : Math.max(8, caret.top - maxHeight - 4);
  return { left, top, width };
}


function escapeClipboardHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function readClipboardMentions(html: string, expectedText: string): RoutineMention[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  let text = "";
  const mentions: RoutineMention[] = [];
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element.tagName === "BR") {
      text += "\n";
      return;
    }
    const start = Array.from(text).length;
    for (const child of Array.from(element.childNodes)) visit(child);
    const end = Array.from(text).length;
    const exerciseId = element.getAttribute("data-cuevapp-exercise-id");
    if (exerciseId && end > start) {
      mentions.push({ exercise_id: exerciseId, start, end, text: codePointSlice(text, start, end) });
    }
  }
  visit(parsed.body);
  if (text !== expectedText || mentions.length === 0) return [];
  try { return validateRoutineMentions(text, mentions); } catch { return []; }
}

export function TextRoutineEditor({ value, mentions, disabled, onChange }: {
  value: string; mentions: RoutineMention[]; disabled: boolean;
  onChange: (value: string, mentions: RoutineMention[]) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null), highlight = useRef<HTMLDivElement>(null), request = useRef(0);
  const previewPanel = useRef<HTMLDivElement>(null), suggestionPanel = useRef<HTMLDivElement>(null), previewRequest = useRef(0);
  const [range, setRange] = useState<SearchRange>(null);
  const [results, setResults] = useState<Exercise[]>([]);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [suggestionPosition, setSuggestionPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [creationTrackingMode, setCreationTrackingMode] = useState<"weight" | "time">("weight");
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
    const measure = () => setSuggestionPosition(floatingPosition(measureCaretRect(input), 360));
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

  function copyMentionSelection(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const input = event.currentTarget;
    if (input.selectionStart === input.selectionEnd) return false;
    const start = utf16OffsetToCodePoint(value, input.selectionStart);
    const end = utf16OffsetToCodePoint(value, input.selectionEnd);
    const selectedText = value.slice(input.selectionStart, input.selectionEnd);
    const copied = mentions
      .filter(mention => mention.start >= start && mention.end <= end)
      .map(mention => ({ ...mention, start: mention.start - start, end: mention.end - start }));
    if (!copied.length) return false;

    let cursor = 0;
    let html = "";
    for (const mention of copied) {
      html += escapeClipboardHtml(codePointSlice(selectedText, cursor, mention.start)).replace(/\n/g, "<br>");
      html += '<span data-cuevapp-exercise-id="' + mention.exercise_id + '">' + escapeClipboardHtml(mention.text) + "</span>";
      cursor = mention.end;
    }
    html += escapeClipboardHtml(codePointSlice(selectedText, cursor, Array.from(selectedText).length)).replace(/\n/g, "<br>");
    event.clipboardData.setData("text/plain", selectedText);
    try { event.clipboardData.setData("text/html", "<div>" + html + "</div>"); } catch { /* Plain text remains available. */ }
    try {
      event.clipboardData.setData("application/x-cuevapp-routine-mentions", JSON.stringify({
        version: 1, text: selectedText, mentions: copied,
      }));
    } catch { /* HTML clipboard data remains as a cross-browser fallback. */ }
    event.preventDefault();
    return true;
  }

  function handleCopy(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    copyMentionSelection(event);
  }

  function handleCut(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    if (!copyMentionSelection(event)) return;
    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = value.slice(0, start) + value.slice(end);
    input.setRangeText("", start, end, "end");
    onChange(next, rebaseRoutineMentions(value, next, mentions));
    updateRange(null);
  }

  function handlePaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const input = event.currentTarget;
    const plain = event.clipboardData.getData("text/plain");
    if (!plain) return;
    let pastedMentions: RoutineMention[] = [];
    const custom = event.clipboardData.getData("application/x-cuevapp-routine-mentions");
    if (custom) {
      try {
        const payload = JSON.parse(custom) as { version?: number; text?: string; mentions?: unknown };
        if (payload.version === 1 && payload.text === plain) {
          pastedMentions = validateRoutineMentions(plain, payload.mentions);
        }
      } catch { pastedMentions = []; }
    }
    if (!pastedMentions.length) {
      const html = event.clipboardData.getData("text/html");
      if (html) pastedMentions = readClipboardMentions(html, plain);
    }
    if (!pastedMentions.length) return;

    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const pasteStart = utf16OffsetToCodePoint(value, selectionStart);
    const pasteLength = Array.from(plain).length;
    const pasteEnd = pasteStart + pasteLength;
    const next = value.slice(0, selectionStart) + plain + value.slice(selectionEnd);
    const preserved = rebaseRoutineMentions(value, next, mentions)
      .filter(mention => mention.end <= pasteStart || mention.start >= pasteEnd);
    const inserted = pastedMentions.map(mention => ({
      ...mention, start: mention.start + pasteStart, end: mention.end + pasteStart,
    }));
    let nextMentions: RoutineMention[];
    try { nextMentions = validateRoutineMentions(next, [...preserved, ...inserted].sort((a, b) => a.start - b.start)); }
    catch { return; }
    event.preventDefault();
    input.setRangeText(plain, selectionStart, selectionEnd, "end");
    onChange(next, nextMentions);
    updateRange(null);
    previewRequest.current++;
    setPreview(null);
    setPreviewError("");
    setPreviewPending(false);
    setPreviewPosition(null);
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
          description: "", video_url: null, video_path: null, tracking_mode: creationTrackingMode,
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
    const sequence = ++previewRequest.current;
    if (input.selectionStart !== input.selectionEnd) {
      setPreview(null); setPreviewError(""); setPreviewPending(false); setPreviewPosition(null);
      return;
    }
    const cursor = utf16OffsetToCodePoint(value, input.selectionStart);
    const mention = mentions.find(item => cursor >= item.start && cursor <= item.end);
    if (!mention) {
      setPreview(null); setPreviewError(""); setPreviewPending(false); setPreviewPosition(null);
      return;
    }
    setPreview(null); setPreviewError(""); setPreviewPending(true);
    setPreviewPosition(floatingPosition(measureCaretRect(input), 320));
    try {
      const params = new URLSearchParams({ q: mention.text });
      const response = await fetch("/api/ejercicios?" + params, { cache: "no-store" });
      const data = await response.json();
      if (sequence !== previewRequest.current) return;
      const exercise = Array.isArray(data.exercises) ? data.exercises.find((item: Exercise) => item.id === mention.exercise_id) : null;
      if (!response.ok || !exercise) throw new Error(data.message || "No pudimos cargar los datos del ejercicio.");
      setPreview(exercise);
    } catch (cause) {
      if (sequence === previewRequest.current) setPreviewError(cause instanceof Error ? cause.message : "No pudimos cargar los datos del ejercicio.");
    } finally {
      if (sequence === previewRequest.current) setPreviewPending(false);
    }
  }

  useEffect(() => {
    if (!range) return;
    function closeSuggestions(event: PointerEvent) {
      if (event.target instanceof Node
        && !textarea.current?.contains(event.target)
        && !suggestionPanel.current?.contains(event.target)) updateRange(null);
    }
    document.addEventListener("pointerdown", closeSuggestions);
    return () => document.removeEventListener("pointerdown", closeSuggestions);
  }, [range, updateRange]);

  useEffect(() => {
    if (playerOpen || (!preview && !previewPending && !previewError)) return;
    function dismiss(event: Event) {
      if (event.type === "keydown" && (event as globalThis.KeyboardEvent).key !== "Escape") return;
      if (event.type === "pointerdown" && event.target instanceof Node
        && (previewPanel.current?.contains(event.target) || textarea.current?.contains(event.target))) return;
      previewRequest.current++;
      setPreview(null);
      setPreviewError("");
      setPreviewPending(false);
      setPreviewPosition(null);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [preview, previewPending, previewError, playerOpen]);

  function syncHighlightScroll() {
    if (textarea.current && highlight.current) {
      highlight.current.scrollTop = textarea.current.scrollTop;
      highlight.current.scrollLeft = textarea.current.scrollLeft;
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
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
      <textarea ref={textarea} id="routine-free-text" rows={16} maxLength={40000} value={value} disabled={disabled || creatingExercise}
      aria-autocomplete="list" aria-controls="routine-mention-options"
      onScroll={syncHighlightScroll}
      onChange={event => handleChange(event.target.value, event.target.selectionStart)}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
      onClick={event => { updateRange(null); void openMentionAtCursor(event.currentTarget); }}
      onKeyDown={onKeyDown}
      placeholder={"Escribí la rutina completa…\n\nPodés mencionar ejercicios con @ o escribir su nombre."} />

    </div>
    {(previewPending || previewError || (preview && !playerOpen)) && previewPosition && typeof document !== "undefined" && createPortal(<div ref={previewPanel} className="routine-text-mention-preview" role="dialog" aria-label={preview ? "Ejercicio: " + preview.name : "Cargando ejercicio"} style={{ position: "fixed", left: previewPosition.left, top: previewPosition.top, width: previewPosition.width, maxHeight: "min(240px, calc(100dvh - 16px))", overflow: "auto", zIndex: 1001 }}>
      {previewPending && <p role="status">Cargando ejercicio…</p>}
      {previewError && <p role="alert">{previewError}</p>}
      {preview && !playerOpen && <>
        <strong>{preview.name}</strong>
        {preview.description && <p>{preview.description}</p>}
        {preview.video_url || preview.video_path
          ? <button type="button" onClick={() => { updateRange(null); setPlayerOpen(true); }}>Ver video</button>
          : <span role="status">Aún no se encuentra con video disponible</span>}
        <button type="button" className="routine-text-mention-close" onClick={() => { previewRequest.current++; setPreview(null); setPreviewPosition(null); }}>Cerrar</button>
      </>}
    </div>, document.body)}
    {playerOpen && preview && <ExerciseVideoDialog exerciseId={preview.id} exerciseName={preview.name} open onClose={() => { setPlayerOpen(false); previewRequest.current++; setPreview(null); setPreviewPosition(null); }} /> }
    {range && suggestionPosition && typeof document !== "undefined" && createPortal(<div ref={suggestionPanel} className="routine-mention-suggestions" role="listbox" id="routine-mention-options" aria-label="Ejercicios sugeridos" style={{ position: "fixed", left: suggestionPosition.left, top: suggestionPosition.top, width: suggestionPosition.width, maxHeight: "min(240px, calc(100dvh - 16px))", zIndex: 1000 }}>
      {pending && <p role="status">Buscando ejercicios…</p>}
      {createError && <p role="alert">{createError}</p>}
      {!pending && !error && range.query.trim() && !results.some(exercise => exercise.name.trim().toLocaleLowerCase() === range.query.trim().toLocaleLowerCase()) && <>
        <label className="routine-mention-create-mode">Registro
          <select value={creationTrackingMode} disabled={disabled || creatingExercise} onChange={event => setCreationTrackingMode(event.target.value as "weight" | "time")}>
            <option value="weight">Peso (kg)</option>
            <option value="time">Tiempo (sin kg)</option>
          </select>
        </label>
        <button type="button" disabled={disabled || creatingExercise} onMouseDown={event => event.preventDefault()} onClick={() => void createExerciseFromMention()}>{creatingExercise ? "Creando ejercicio…" : `Crear “${range.query.trim()}” en Ejercicios`}</button>
      </>}
      {error && <><p role="alert">{error}</p><button type="button" disabled={disabled || pending} onClick={retrySearch}>Reintentar búsqueda</button></>}
      {!pending && !error && results.length === 0 && <p>No encontramos ejercicios activos con ese nombre.</p>}
      {results.map((exercise, index) => <button type="button" role="option" aria-selected={active === index} key={exercise.id} disabled={disabled || pending}
        onMouseDown={event => event.preventDefault()} onClick={() => insert(exercise)}>{exercise.name}</button>)}
    </div>, document.body)}
    <p>Las menciones quedan vinculadas al ejercicio aunque cambie su nombre. Solo se sugieren ejercicios activos.</p>
    <p className="routine-text-mention-count">{mentions.length} {mentions.length === 1 ? "mención vinculada" : "menciones vinculadas"}</p>
  </div>;
}
