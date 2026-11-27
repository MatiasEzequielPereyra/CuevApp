"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { requestWorkoutSummary } from "@/lib/routines/workout-summary-batch";

type WorkoutSet = { reps: string; weight: string; duration: string };
type HistorySet = { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null };
type HistoryEntry = {
  id: string;
  revision: number;
  performed_at: string;
  mode: "quick" | "sets";
  tracking_mode: "weight" | "time";
  weight_kg: number | null;
  duration_seconds: number | null;
  sets: HistorySet[];
};
type WorkoutHistory = {
  last_weight_kg: number | null;
  last_duration_seconds: number | null;
  entries: HistoryEntry[];
  has_more: boolean;
};

function parseWeight(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const weight = Number(normalized);
  return Number.isFinite(weight) && weight >= 0 && weight <= 2000 ? weight : null;
}

function parseDuration(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const seconds = Number(normalized);
  return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 86400 ? seconds : null;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${seconds} s`;
  if (!remainder) return `${minutes} min`;
  return `${minutes} min ${remainder} s`;
}

function formatWeight(weight: number) {
  return `${weight.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;
}

function entrySummary(entry: HistoryEntry) {
  if (entry.mode === "quick") {
    return entry.tracking_mode === "weight"
      ? (entry.weight_kg === null ? "" : formatWeight(entry.weight_kg))
      : (entry.duration_seconds === null ? "" : formatDuration(entry.duration_seconds));
  }
  if (entry.tracking_mode === "weight") {
    return entry.sets.map(set => `${set.reps} rep. · ${set.weight_kg === null ? "—" : formatWeight(set.weight_kg)}`).join(" · ");
  }
  return entry.sets.map((set, index) => `Serie ${index + 1}: ${set.duration_seconds === null ? "—" : formatDuration(set.duration_seconds)}`).join(" · ");
}

type AvailableExercise = { id: string; name: string; tracking_mode: "weight" | "time" };
type PanelPosition = { left: number; top: number; width: number; maxHeight: number };

export function StudentWorkoutLogger({ publicationId, exerciseId, exerciseName, targetId, trackingMode, availableExercises = [], onExerciseChange, studentId, embedded = false }: {
  publicationId: string;
  studentId?: string;
  embedded?: boolean;
  exerciseId: string;
  exerciseName: string;
  targetId?: string;
  trackingMode: "weight" | "time";
  availableExercises?: AvailableExercise[];
  onExerciseChange?: (exercise: AvailableExercise) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const historyRequestExercise = useRef<string | null>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [expanded, setExpanded] = useState(embedded);
  const positionPanel = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(380, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const placeBelow = below >= 280 || below >= above;
    const maxHeight = Math.max(160, Math.min(520, placeBelow ? below : above));
    const top = placeBelow ? rect.bottom + 8 : Math.max(12, rect.top - maxHeight - 8);
    setPanelPosition({ left, top, width, maxHeight });
  }, []);
  const [mode, setMode] = useState<"quick" | "sets">("quick");
  const [weightState, setWeightState] = useState({ exerciseId, value: "", dirty: false });
  const [durationState, setDurationState] = useState({ exerciseId, value: "", dirty: false });
  const weight = weightState.exerciseId === exerciseId ? weightState.value : "";
  const duration = durationState.exerciseId === exerciseId ? durationState.value : "";
  const setWeight = useCallback((value: string) => setWeightState({ exerciseId, value, dirty: true }), [exerciseId]);
  const setDuration = useCallback((value: string) => setDurationState({ exerciseId, value, dirty: true }), [exerciseId]);
  const seedInputs = useCallback((next: WorkoutHistory) => {
    // Server suggestions initialize untouched fields; explicit typing, clearing,
    // "Usar" and editing history own the draft, including after a save.
    if (next.last_weight_kg != null) setWeightState(current =>
      current.exerciseId === exerciseId && current.dirty ? current
        : { exerciseId, value: String(next.last_weight_kg), dirty: false });
    if (next.last_duration_seconds != null) setDurationState(current =>
      current.exerciseId === exerciseId && current.dirty ? current
        : { exerciseId, value: String(next.last_duration_seconds), dirty: false });
  }, [exerciseId]);
  const [sets, setSets] = useState<WorkoutSet[]>([{ reps: "", weight: "", duration: "" }]);
  const [historyState, setHistoryState] = useState<{ exerciseId: string; history: WorkoutHistory | null }>({ exerciseId, history: null });
  const history = historyState.exerciseId === exerciseId ? historyState.history : null;
  const activeTrackingMode = studentId && history?.entries[0] ? history.entries[0].tracking_mode : trackingMode;
  const [summaryState, setSummaryState] = useState<{ exerciseId: string; entry: HistoryEntry | null }>({ exerciseId, entry: null });
  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(embedded);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);
  const readVersion = useRef(0);
  const advanceReadVersion = useCallback(() => ++readVersion.current, []);

  const loadHistory = useCallback(async (offset = 0, showLoading = true) => {
    const version = advanceReadVersion();
    if (showLoading) setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ exercise_id: exerciseId, offset: String(offset), limit: "3" });
      if (studentId) params.set("student_id", studentId);
      const response = await fetch("/api/entrenamientos?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (version !== readVersion.current) return;
      if (!response.ok) throw new Error(data.message || "No pudimos cargar el historial.");
      const next = data.history as WorkoutHistory;
      setHistoryState(current => ({
        exerciseId,
        history: offset > 0 && current.exerciseId === exerciseId && current.history
          ? { ...next, entries: [...current.history.entries, ...next.entries] }
          : next,
      }));
      if (offset === 0) setSummaryState({ exerciseId, entry: next.entries[0] ?? null });
      if (offset === 0) seedInputs(next);
    } catch (cause) {
      if (version === readVersion.current) setError(cause instanceof Error ? cause.message : "No pudimos cargar el historial.");
    } finally {
      if (showLoading && version === readVersion.current) setLoadingHistory(false);
    }
  }, [exerciseId, seedInputs, advanceReadVersion, studentId]);

  // Keep the latest workout summary in sync on first render/reload without
  // eagerly downloading the full editable history for every exercise.
  useEffect(() => {
    let cancelled = false;
    const version = readVersion.current;
    void (async () => {
      try {
        const next = await requestWorkoutSummary(exerciseId, false, studentId);
        if (cancelled || version !== readVersion.current) return;
        setSummaryState({ exerciseId, entry: next.entries?.[0] ?? null });
        seedInputs(next);
      } catch {
        // The logger and full history remain available if the summary request fails.
      }
    })();
        const panelContent = (
        <div ref={panel} id={id + "-panel"} className="student-workout-panel student-workout-floating-panel" role="dialog" aria-label={"Registro de " + exerciseName}
          style={embedded ? undefined : { position: "fixed", left: panelPosition?.left, top: panelPosition?.top, width: panelPosition?.width, maxHeight: panelPosition?.maxHeight, overflow: "auto", zIndex: 2147483000 }}>
          <header>
            <strong>{exerciseName}</strong>
            {!embedded && <button type="button" className="student-workout-close" aria-label="Cerrar registro" onClick={() => { setExpanded(false); trigger.current?.focus({ preventScroll: true }); }}>×</button>}
            <button type="button" onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen}>
              {historyOpen ? "Ocultar historial" : "Ver historial"}
            </button>
          </header>
          {availableExercises.length > 1 && (
            <label className="student-workout-exercise-picker">Ejercicio
              <select value={exerciseId} disabled={saving} onChange={event => {
                const selected = availableExercises.find(item => item.id === event.target.value);
                if (!selected) return;
                // Never carry one exercise's series draft or edit target into another UUID.
                setMode("quick");
                setSets([{ reps: "", weight: "", duration: "" }]);
                setEditingEntry(null);
                setHistoryOpen(false);
                setMessage("");
                setError("");
                onExerciseChange?.(selected);
              }}>
                {availableExercises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
          {loadingHistory && <p role="status">Consultando tus últimos registros…</p>}
          {activeTrackingMode === "weight" && history?.last_weight_kg !== null && history?.last_weight_kg !== undefined && (
            <p className="student-workout-last">
              Último peso: <strong>{formatWeight(history.last_weight_kg)}</strong>
              <button type="button" onClick={() => { setMode("quick"); setWeight(String(history.last_weight_kg)); }}>Usar</button>
              {!studentId && <button type="button" disabled={saving || loadingHistory} onClick={() => void save("quick", history.last_weight_kg ?? undefined)}>Guardar último peso</button>}
            </p>
          )}
          {activeTrackingMode === "time" && history?.last_duration_seconds !== null && history?.last_duration_seconds !== undefined && (
            <p className="student-workout-last">
              Última duración: <strong>{formatDuration(history.last_duration_seconds)}</strong>
              <button type="button" onClick={() => { setMode("quick"); setDuration(String(history.last_duration_seconds)); }}>Usar</button>
              {!studentId && <button type="button" disabled={saving || loadingHistory} onClick={() => void save("quick", history.last_duration_seconds ?? undefined)}>Guardar última duración</button>}
            </p>
          )}
          <div className="student-workout-modes" role="group" aria-label="Tipo de registro">
            <button type="button" aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>Rápido</button>
            <button type="button" aria-pressed={mode === "sets"} onClick={() => setMode("sets")}>Por series</button>
          </div>
          {studentId && !editingEntry ? <p className="student-workout-editing">Como administrador podés consultar el historial y editar registros existentes.</p> : mode === "quick" ? (
            activeTrackingMode === "weight" ? (
              <label htmlFor={id + "-weight"}>Peso utilizado (kg)
                <input id={id + "-weight"} inputMode="decimal" value={weight} maxLength={10}
                  onChange={event => setWeight(event.target.value)} placeholder="Ej. 40" />
              </label>
            ) : (
              <label htmlFor={id + "-duration"}>Duración (segundos)
                <input id={id + "-duration"} inputMode="numeric" value={duration} maxLength={5}
                  onChange={event => setDuration(event.target.value)} placeholder="Ej. 60" />
              </label>
            )
          ) : (
            <div className="student-workout-sets">
              {sets.map((item, index) => (
                <div className="student-workout-set" key={index}>
                  <strong>Serie {index + 1}</strong>
                  {activeTrackingMode === "weight" ? (
                    <>
                      <label>Repeticiones
                        <input inputMode="numeric" value={item.reps} maxLength={4}
                          onChange={event => setSets(current => current.map((row, i) => i === index ? { ...row, reps: event.target.value } : row))} />
                      </label>
                      <label>Peso (kg)
                        <input inputMode="decimal" value={item.weight} maxLength={10}
                          onChange={event => setSets(current => current.map((row, i) => i === index ? { ...row, weight: event.target.value } : row))} />
                      </label>
                    </>
                  ) : (
                    <label>Duración (segundos)
                      <input inputMode="numeric" value={item.duration} maxLength={5}
                        onChange={event => setSets(current => current.map((row, i) => i === index ? { ...row, duration: event.target.value } : row))} />
                    </label>
                  )}
                  {sets.length > 1 && <button type="button" onClick={() => setSets(current => current.filter((_, i) => i !== index))}>Quitar</button>}
                </div>
              ))}
              <button type="button" disabled={sets.length >= 30} onClick={() => setSets(current => [...current, { reps: "", weight: "", duration: "" }])}>Agregar serie</button>
            </div>
          )}
          {editingEntry && <p className="student-workout-editing">Editando un registro anterior <button type="button" onClick={cancelEdit}>Cancelar edición</button></p>}
          {(!studentId || editingEntry) && <button type="button" className="student-workout-save" disabled={saving || loadingHistory} onClick={() => void save()}>
            {saving ? "Guardando…" : editingEntry ? "Guardar cambios" : "Guardar resultado"}
          </button>}
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          {historyOpen && (
            <div className="student-workout-history">
              <h4>Historial de este ejercicio</h4>
              {!history?.entries.length ? <p>Todavía no hay registros.</p> : (
                <ol>
                  {history.entries.map(entry => (
                    <li key={entry.id}>
                      <time dateTime={entry.performed_at}>{new Date(entry.performed_at).toLocaleDateString("es-AR", { dateStyle: "short" })}</time>
                      <strong className="student-workout-history-value">{entrySummary(entry) || "—"}</strong>
                      <div className="student-workout-history-actions">
                        {entry.tracking_mode === activeTrackingMode && <>
                          <button type="button" disabled={saving} onClick={() => applyHistoryEntry(entry)}>Usar</button>
                          <button type="button" disabled={saving} onClick={() => beginEdit(entry)}>Editar</button>
                        </>}
                        {!studentId && <button type="button" className="student-workout-history-delete" disabled={saving} onClick={() => void deleteHistoryEntry(entry)}>Eliminar</button>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

            </div>
          )}
        </div>,
      );

  return () => { cancelled = true; advanceReadVersion(); };
  }, [exerciseId, publicationId, studentId, seedInputs, advanceReadVersion]);

  async function save(modeOverride?: "quick" | "sets", quickValueOverride?: number) {
    if (busy.current) return;
    busy.current = true;
    const selectedMode = modeOverride ?? mode;
    setSaving(true);
    setMessage("");
    setError("");
    let payloadSets: { reps: number; weight_kg: number }[] | { duration_seconds: number }[] = [];
    let quickWeight: number | null = null;
    let quickDuration: number | null = null;

    if (selectedMode === "quick") {
      if (activeTrackingMode === "weight") {
        quickWeight = quickValueOverride ?? parseWeight(weight);
        if (quickWeight === null) {
          setError("Ingresá un peso entre 0 y 2000 kg, con hasta dos decimales.");
          setSaving(false);
          busy.current = false;
          return;
        }
      } else {
        quickDuration = quickValueOverride ?? parseDuration(duration);
        if (quickDuration === null) {
          setError("Ingresá una duración entre 1 y 86400 segundos.");
          setSaving(false);
          busy.current = false;
          return;
        }
      }
    } else if (activeTrackingMode === "weight") {
      const weightSets = sets.map(item => ({ reps: Number(item.reps), weight_kg: parseWeight(item.weight) ?? Number.NaN }));
      if (!weightSets.length || weightSets.some(item => !Number.isInteger(item.reps)
        || item.reps < 1 || item.reps > 1000 || !Number.isFinite(item.weight_kg))) {
        setError("Completá las repeticiones y el peso de cada serie.");
        setSaving(false);
        busy.current = false;
        return;
      }
      payloadSets = weightSets;
    } else {
      const durationSets = sets.map(item => ({ duration_seconds: parseDuration(item.duration) ?? Number.NaN }));
      if (!durationSets.length || durationSets.some(item => !Number.isFinite(item.duration_seconds))) {
        setError("Completá la duración en segundos de cada serie.");
        setSaving(false);
        busy.current = false;
        return;
      }
      payloadSets = durationSets;
    }

    const payload = {
      mode: selectedMode,
      tracking_mode: activeTrackingMode,
      weight_kg: quickWeight,
      duration_seconds: quickDuration,
      sets: payloadSets,
    };
    const fingerprint = JSON.stringify({ publicationId, exerciseId, targetId, ...payload });
    const operationId = editingEntry ? null : operation.current?.fingerprint === fingerprint
      ? operation.current.id
      : crypto.randomUUID();
    if (operationId) operation.current = { fingerprint, id: operationId };
    // A read started before this write cannot replace the refreshed result.
    const version = advanceReadVersion();
    try {
      const response = await fetch("/api/entrenamientos", {
        method: editingEntry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(editingEntry
          ? { entry_id: editingEntry.id, revision: editingEntry.revision, ...(studentId ? { student_id: studentId } : {}), ...payload }
          : { id: operationId, publication_id: publicationId, exercise_id: exerciseId, target_id: targetId ?? null, ...payload }),
      });
      const data = await response.json();
      if (version !== readVersion.current) return;
      if (!response.ok) throw new Error(data.message || "No pudimos guardar el registro.");
      operation.current = null;
      setMessage(editingEntry ? "Cambios guardados." : "Resultado guardado.");
      window.dispatchEvent(new CustomEvent("cueva-workout-updated", { detail: { exerciseId } }));
      setEditingEntry(null);
      await loadHistory(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar el registro.");
    } finally {
      setSaving(false);
      busy.current = false;
    }
  }

  function beginEdit(entry: HistoryEntry) {
    if (entry.tracking_mode !== activeTrackingMode) return;
    setEditingEntry(entry);
    setExpanded(true);
    setMode(entry.mode);
    if (entry.mode === "quick") {
      setWeight(entry.weight_kg === null ? "" : String(entry.weight_kg));
      setDuration(entry.duration_seconds === null ? "" : String(entry.duration_seconds));
    } else if (entry.tracking_mode === "weight") {
      setSets(entry.sets.map(set => ({ reps: set.reps === null ? "" : String(set.reps), weight: set.weight_kg === null ? "" : String(set.weight_kg), duration: "" })));
    } else {
      setSets(entry.sets.map(set => ({ reps: "", weight: "", duration: set.duration_seconds === null ? "" : String(set.duration_seconds) })));
    }
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingEntry(null);
    setMessage("");
    setError("");
  }

  function applyHistoryEntry(entry: HistoryEntry) {
    setEditingEntry(null);
    setMode("quick");
    if (activeTrackingMode === "weight") {
      const value = entry.mode === "quick" ? entry.weight_kg : entry.sets.at(-1)?.weight_kg;
      if (value === null || value === undefined) return;
      setWeight(String(value));
    } else {
      const value = entry.mode === "quick" ? entry.duration_seconds : entry.sets.at(-1)?.duration_seconds;
      if (value === null || value === undefined) return;
      setDuration(String(value));
    }
    setMessage("Valor del historial listo para usar.");
    setError("");
  }

  async function deleteHistoryEntry(entry: HistoryEntry) {
    if (busy.current || saving) return;
    if (!window.confirm("¿Eliminar este registro del historial?")) return;
    busy.current = true;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/entrenamientos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ entry_id: entry.id, revision: entry.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No pudimos eliminar el registro.");
      if (editingEntry?.id === entry.id) setEditingEntry(null);
      setMessage("Registro eliminado.");
      await loadHistory(0);
      window.dispatchEvent(new CustomEvent("cueva-workout-updated", { detail: { exerciseId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos eliminar el registro.");
    } finally {
      setSaving(false);
      busy.current = false;
    }
  }

  useEffect(() => {
    if (!expanded) {
      historyRequestExercise.current = null;
      return;
    }
    if (historyRequestExercise.current === exerciseId) return;
    historyRequestExercise.current = exerciseId;
    void loadHistory(0);
  }, [expanded, exerciseId, loadHistory]);

  useEffect(() => {
    if (!expanded || embedded) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node
        && !trigger.current?.contains(event.target)
        && !panel.current?.contains(event.target)) setExpanded(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        trigger.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [expanded, embedded, positionPanel, exerciseId, mode, historyOpen]);

  const summaryEntry = summaryState.exerciseId === exerciseId ? summaryState.entry : null;
  const summary = summaryEntry?.tracking_mode === activeTrackingMode ? entrySummary(summaryEntry) : "";

  return (
    <section className="student-workout" aria-label={"Registro de " + exerciseName} data-tracking-mode={activeTrackingMode}>
      {!embedded && (
      <button ref={trigger} type="button" className="student-workout-toggle" aria-haspopup="dialog" aria-controls={id + "-panel"} aria-label={expanded ? (activeTrackingMode === "weight" ? "Cerrar registro de peso" : "Cerrar registro de duración") : (activeTrackingMode === "weight" ? "Registrar peso" : "Registrar duración")} aria-expanded={expanded} onClick={() => {
        const nextExpanded = !expanded;
        if (nextExpanded) positionPanel();
        setExpanded(nextExpanded);
        setMessage("");
        setError("");
      }}>
        {expanded
          ? <><span aria-hidden="true">×</span><span>Cerrar</span></>
          : <>{activeTrackingMode === "weight" ? (
            <svg className="student-workout-toggle-icon student-workout-kettlebell" viewBox="0 0 32 34" aria-hidden="true" focusable="false">
              <path d="M11 11V8c0-3.4 1.8-5 5-5s5 1.6 5 5v3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M9 11c-3.6 0-5.4 3.4-4.5 8.2l2.2 8.1C7.5 31 10.5 32 16 32s8.5-1 9.3-4.7l2.2-8.1C28.4 14.4 26.6 11 23 11Z" fill="currentColor" />
              <text x="16" y="23.5" textAnchor="middle" fontSize="8.2" fontWeight="800" letterSpacing=".1" fill="var(--dash-panel)">KG</text>
            </svg>
          ) : <span className="student-workout-toggle-icon" aria-hidden="true">◷</span>}<span>{summary ? (activeTrackingMode === "weight" ? "Editar peso" : "Editar duración") : (activeTrackingMode === "weight" ? "Cargar peso" : "Cargar duración")}</span></>}
      </button>
      )}
      {embedded ? panelContent : expanded && panelPosition && typeof document !== "undefined" ? createPortal(panelContent, document.body) : null}
    </section>
  );
}
